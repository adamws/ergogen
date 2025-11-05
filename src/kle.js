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

    // Detect ergogen's unit system
    // Ergogen differentiates between keycap size (width/height) and spacing (padding/spread)
    // Default: width=18, height=18, padding=19

    // Find spacing unit from the points (should be consistent across the layout)
    let spacingUnit = 19 // default padding/spread
    for (const point of Object.values(points)) {
        if (point.meta && point.meta.padding !== undefined) {
            spacingUnit = point.meta.padding
            break
        }
    }

    // The standard key size is typically (spacing - 1)
    // This accounts for the 1-unit gap between keys in ergogen
    const standardKeySize = spacingUnit - 1 // typically 18 when spacing is 19

    // KLE uses a unified "U" unit system:
    // - For POSITIONS: use spacing unit (the grid)
    // - For DIMENSIONS: use standard key size (so 18-unit keys become 1U)

    const normalizePosition = (value) => value / spacingUnit
    const normalizeDimension = (value) => {
        const normalized = value / standardKeySize
        // Round to nearest 0.25U for cleaner output
        // This handles floating point precision issues
        const rounded = Math.round(normalized * 4) / 4
        return rounded
    }

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

            // Get key dimensions from metadata (default to standardKeySize if not specified)
            const keyWidth = point.meta.width !== undefined ? point.meta.width : standardKeySize
            const keyHeight = point.meta.height !== undefined ? point.meta.height : standardKeySize

            // Normalize dimensions to KLE units (18 → 1U, 36 → 2U, etc.)
            const width = normalizeDimension(keyWidth)
            const height = normalizeDimension(keyHeight)

            key.width = width
            key.height = height

            // Handle rotation
            if (point.r !== 0) {
                key.rotation_angle = -point.r // Flip rotation direction

                // Get the rotation origin from ergogen's metadata
                // In ergogen, origin is the offset from key center where rotation happens
                let originX = 0
                let originY = 0
                if (point.meta.origin && Array.isArray(point.meta.origin)) {
                    originX = point.meta.origin[0] || 0
                    originY = point.meta.origin[1] || 0
                }

                // Calculate the absolute rotation origin in ergogen coordinates
                // The rotation happens at (key_position + origin_offset)
                const rotOriginAbsX = point.x + originX
                const rotOriginAbsY = point.y + originY

                // Convert rotation origin to KLE units (using position normalization)
                key.rotation_x = normalizePosition(rotOriginAbsX)
                key.rotation_y = normalizePosition(-rotOriginAbsY) // Flip Y axis

                // Key position is relative to the rotation origin in KLE
                // offset = key_position - rotation_origin
                key.x = normalizePosition(-originX) - (width - 1) / 2
                key.y = normalizePosition(originY) - (height - 1) / 2
            } else {
                // For non-rotated keys, use absolute position
                // Convert positions to KLE units (using position normalization)
                key.x = normalizePosition(point.x) - (width - 1) / 2
                key.y = normalizePosition(-point.y) - (height - 1) / 2 // Flip Y axis
            }

            // Set label if available
            const label = point.meta.label || point.meta.name || point.name || ''
            key.labels[0] = label

            keyboard.keys.push(key)
        }
    }

    // Normalize positions: offset everything so the minimum x and y are at 0
    // This makes the layout start at the origin, which is more intuitive
    if (keyboard.keys.length > 0) {
        // Find minimum x and y across all keys
        let minX = Infinity
        let minY = Infinity

        for (const key of keyboard.keys) {
            // For rotated keys, we need to consider the rotation origin
            const x = key.rotation_angle !== 0 ? key.rotation_x : key.x
            const y = key.rotation_angle !== 0 ? key.rotation_y : key.y

            if (x < minX) minX = x
            if (y < minY) minY = y
        }

        // Offset all keys by the minimum values
        for (const key of keyboard.keys) {
            if (key.rotation_angle !== 0) {
                // For rotated keys, offset only the rotation origin
                // The x, y values are relative to the rotation origin, so leave them alone
                key.rotation_x -= minX
                key.rotation_y -= minY
            } else {
                // For non-rotated keys, offset the position
                key.x -= minX
                key.y -= minY
            }

            // Round all positions to 3 decimal places for cleaner output
            key.x = Math.round(key.x * 1000) / 1000
            key.y = Math.round(key.y * 1000) / 1000
            if (key.rotation_x !== undefined) {
                key.rotation_x = Math.round(key.rotation_x * 1000) / 1000
            }
            if (key.rotation_y !== undefined) {
                key.rotation_y = Math.round(key.rotation_y * 1000) / 1000
            }

            // Round dimensions to 3 decimal places
            if (key.width !== 1) {
                key.width = Math.round(key.width * 1000) / 1000
            }
            if (key.height !== 1) {
                key.height = Math.round(key.height * 1000) / 1000
            }
        }
    }

    // Serialize the keyboard to KLE format
    return kle.Serial.serialize(keyboard)
}
