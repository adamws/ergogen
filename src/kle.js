const u = require('./utils')
const kle = require('kle-serial2')
const yaml = require('js-yaml')

exports.convert = (config, logger) => {
    const keyboard = kle.Serial.deserialize(config)
    const result = {points: {zones: {}}}

    // if the keyboard notes are valid YAML/JSON, they get added to each key as metadata
    let meta
    try {
        meta = yaml.load(keyboard.meta.notes)
    } catch (ex) {
        // notes were not valid YAML/JSON, oh well...
    }
    meta = meta || {}

    let index = 1
    for (const key of keyboard.keys) {
        const id = `key${index++}`
        const colid = `${id}col`
        const rowid = `${id}row`
        // we try to look at the first non-empty label
        const label = key.labels.filter(e => !!e)[0] || ''

        // PCB nets can be specified through key labels
        let row_net = id
        let col_net = 'GND'
        if (label.match(/^\d+_\d+$/)) {
            const parts = label.split('_')
            row_net = `row_${parts[0]}`
            col_net = `col_${parts[1]}`
        }

        // need to account for keycap sizes, as KLE anchors
        // at the corners, while we consider the centers
        const x = key.x + (key.width - 1) / 2
        const y = key.y + (key.height - 1) / 2

        // KLE rotations have an absolute origin, which is the
        // top left corner of a standard keycap, so we adjust
        // by half of its size, to match where Ergogen positions
        // its keys
        const origin_x = key.rotation_x - 0.5;
        const origin_y = key.rotation_y - 0.5;

        // anchoring the per-key zone to the KLE-computed coords
        const converted = {
            key: {
                origin: [`${origin_x} u`, `${-origin_y} u`],
                splay: -key.rotation_angle,
                shift: [`${x} u`, `${-y} u`],
            },
            columns: {}
        }

        // adding a column-level rotation with origin
        converted.columns[colid] = {
            rows: {}
        }

        // passing along metadata to each key
        converted.columns[colid].rows[rowid] = u.deepcopy(meta)
        converted.columns[colid].rows[rowid].width = `${key.width} u`
        converted.columns[colid].rows[rowid].height = `${key.height} u`
        converted.columns[colid].rows[rowid].label = label
        converted.columns[colid].rows[rowid].column_net = col_net
        converted.columns[colid].rows[rowid].row_net = row_net

        result.points.zones[id] = converted
    }

    return result
}

exports.serialize = (points, logger) => {
    // Create a new Keyboard object
    const keyboard = new kle.Keyboard()

    // Convert ergogen points to KLE keys
    // Points is an object where each key is a point name and value contains x, y, r, meta
    const pointsArray = Object.entries(points).map(([name, point]) => {
        return {
            name,
            x: point.x,
            y: point.y,
            r: point.r || 0,
            meta: point.meta || {}
        }
    })

    // Sort by y first, then x to group into rows
    pointsArray.sort((a, b) => {
        const yDiff = a.y - b.y
        if (Math.abs(yDiff) < 0.1) { // tolerance for floating point
            return a.x - b.x
        }
        return yDiff
    })

    // Group points by rotation and rotation origin
    // KLE requires rotation groups to be in separate rows
    const rotationGroups = new Map()

    for (const point of pointsArray) {
        // Create a key for the rotation group
        // Use rotation angle and a grid-snapped origin
        const rotKey = `${point.r.toFixed(2)}`

        if (!rotationGroups.has(rotKey)) {
            rotationGroups.set(rotKey, [])
        }
        rotationGroups.get(rotKey).push(point)
    }

    // Process each rotation group
    for (const [rotKey, group] of rotationGroups) {
        for (const point of group) {
            const key = new kle.Key()

            // Convert ergogen center-based coordinates to KLE corner-based
            // Ergogen uses center coordinates, KLE uses top-left corner
            const width = point.meta.width !== undefined ? point.meta.width / 19 : 1
            const height = point.meta.height !== undefined ? point.meta.height / 19 : 1

            key.width = width
            key.height = height

            // Adjust position to corner (KLE expects top-left corner position)
            key.x = point.x / 19 - (width - 1) / 2
            key.y = -point.y / 19 - (height - 1) / 2 // Flip Y axis

            // Handle rotation
            if (point.r !== 0) {
                key.rotation_angle = -point.r // Flip rotation direction
                // For KLE, rotation origin is where the key rotates around
                // Use the key's position as the rotation origin
                key.rotation_x = key.x + 0.5
                key.rotation_y = key.y + 0.5
            }

            // Set label if available
            const label = point.meta.label || point.meta.name || point.name || ''
            key.labels[0] = label

            keyboard.keys.push(key)
        }
    }

    // Serialize the keyboard to KLE format
    return kle.Serial.serialize(keyboard)
}
