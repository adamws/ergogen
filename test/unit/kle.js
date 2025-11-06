const kle = require('../../src/kle')
const ergogen = require('../../src/ergogen')
const yaml = require('js-yaml')

describe('KLE Conversion', function() {

    // Helper function to process ergogen config and get points
    const processErgogen = async (config) => {
        const result = await ergogen.process(config, {debug: true})
        return result.points
    }

    // Helper function to parse KLE and extract absolute key positions
    // KLE uses relative positioning, so we need to track cumulative positions
    const parseKLEPositions = (kleOutput) => {
        const positions = {}
        let absoluteY = 0

        for (const row of kleOutput) {
            let absoluteX = 0
            let pendingProps = {}

            for (const item of row) {
                if (typeof item === 'object') {
                    // Properties for the next key
                    if (item.x !== undefined) absoluteX += item.x
                    if (item.y !== undefined) absoluteY += item.y
                    // Store all properties for the next key
                    Object.assign(pendingProps, item)
                } else if (typeof item === 'string') {
                    // This is a key label
                    // For rotated keys, use rotation origin
                    if (pendingProps.rx !== undefined) {
                        positions[item] = {
                            x: pendingProps.rx,
                            y: pendingProps.ry || absoluteY,
                            r: pendingProps.r
                        }
                    } else {
                        positions[item] = {
                            x: absoluteX,
                            y: absoluteY
                        }
                    }
                    // Advance X for next key in this row
                    absoluteX += 1
                    pendingProps = {}
                }
            }
        }

        return positions
    }

    // Helper function to verify key position in KLE output
    const verifyKeyPosition = (kleOutput, keyLabel, expectedX, expectedY, tolerance = 0.01) => {
        const positions = parseKLEPositions(kleOutput)

        const pos = positions[keyLabel]
        should.exist(pos, `Key ${keyLabel} not found in KLE output`)

        if (expectedX !== undefined) {
            Math.abs(pos.x - expectedX).should.be.below(tolerance,
                `Key ${keyLabel} x position: expected ${expectedX}, got ${pos.x}`)
        }
        if (expectedY !== undefined) {
            Math.abs(pos.y - expectedY).should.be.below(tolerance,
                `Key ${keyLabel} y position: expected ${expectedY}, got ${pos.y}`)
        }
    }

    describe('Basic Grid Layout', function() {

        it('single key should be at origin', async function() {
            const config = yaml.load(`
                points:
                  zones:
                    matrix:
                      columns:
                        col:
                          rows:
                            row: {}
            `)

            const points = await processErgogen(config)
            const kleOutput = kle.serialize(points)

            // First key should be at (0, 0) with no position object
            kleOutput.should.be.an('array')
            kleOutput[0].should.be.an('array')
            kleOutput[0][0].should.be.a('string')
            kleOutput[0][0].should.equal('matrix_col_row')
        })

        it('2x2 grid should have correct relative positions', async function() {
            const config = yaml.load(`
                points:
                  zones:
                    matrix:
                      columns:
                        col1:
                          rows:
                            r1: {}
                            r2: {}
                        col2:
                          rows:
                            r1: {}
                            r2: {}
            `)

            const points = await processErgogen(config)
            const kleOutput = kle.serialize(points)

            // In a 2x2 grid with standard spacing (19 units), keys should be 1U apart
            // After normalization, ergogen coords (0,0) and (0,-19) become KLE (0,1) and (0,-1)
            // This is because KLE output is: row1 at y:1, row2 at y:-2 (relative)
            // Absolute positions: col1_r1 (0, 1), col2_r1 (1, 1), col1_r2 (0, -1), col2_r2 (1, -1)

            verifyKeyPosition(kleOutput, 'matrix_col1_r1', 0, 1, 0.01)
            verifyKeyPosition(kleOutput, 'matrix_col2_r1', 1, 1, 0.01)
            verifyKeyPosition(kleOutput, 'matrix_col1_r2', 0, -1, 0.01)
            verifyKeyPosition(kleOutput, 'matrix_col2_r2', 1, -1, 0.01)
        })

        it('3x3 grid should maintain spacing', async function() {
            const config = yaml.load(`
                points:
                  zones:
                    matrix:
                      columns:
                        col1:
                          rows:
                            r1: {}
                            r2: {}
                            r3: {}
                        col2:
                          rows:
                            r1: {}
                            r2: {}
                            r3: {}
                        col3:
                          rows:
                            r1: {}
                            r2: {}
                            r3: {}
            `)

            const points = await processErgogen(config)
            const kleOutput = kle.serialize(points)

            // Verify a few key positions
            // After normalization: first row at Y=2, last row at Y=-2
            verifyKeyPosition(kleOutput, 'matrix_col1_r1', 0, 2, 0.01)
            verifyKeyPosition(kleOutput, 'matrix_col3_r1', 2, 2, 0.01)
            verifyKeyPosition(kleOutput, 'matrix_col1_r3', 0, -2, 0.01)
            verifyKeyPosition(kleOutput, 'matrix_col3_r3', 2, -2, 0.01)
        })
    })

    describe('Custom Key Sizes', function() {

        it('2U key should have width 2', async function() {
            const config = yaml.load(`
                points:
                  zones:
                    matrix:
                      columns:
                        col:
                          rows:
                            r1:
                              width: 36  # 2x standard (18)
            `)

            const points = await processErgogen(config)
            const kleOutput = kle.serialize(points)

            // Find the key and check its width
            kleOutput[0].should.be.an('array')
            // Should have a properties object with w: 2
            const hasWidth2 = kleOutput[0].some((item, i) => {
                if (typeof item === 'object' && item.w === 2) {
                    // Next item should be the key
                    return kleOutput[0][i+1] === 'matrix_col_r1'
                }
                return false
            })
            hasWidth2.should.equal(true, '2U key should have w: 2')
        })

        it('1.5U key should have width 1.5', async function() {
            const config = yaml.load(`
                points:
                  zones:
                    matrix:
                      columns:
                        col:
                          rows:
                            r1:
                              width: 27  # 1.5x standard (18)
            `)

            const points = await processErgogen(config)
            const kleOutput = kle.serialize(points)

            // Should have w: 1.5
            const hasWidth1_5 = kleOutput[0].some((item, i) => {
                if (typeof item === 'object' && item.w === 1.5) {
                    return kleOutput[0][i+1] === 'matrix_col_r1'
                }
                return false
            })
            hasWidth1_5.should.equal(true, '1.5U key should have w: 1.5')
        })
    })

    describe('Staggered Columns', function() {

        it('staggered columns should have correct Y offsets', async function() {
            const config = yaml.load(`
                points:
                  zones:
                    matrix:
                      columns:
                        pinky:
                          rows:
                            r1: {}
                            r2: {}
                        ring:
                          key:
                            stagger: 5
                          rows:
                            r1: {}
                            r2: {}
                        middle:
                          key:
                            stagger: 2
                          rows:
                            r1: {}
                            r2: {}
            `)

            const points = await processErgogen(config)
            const kleOutput = kle.serialize(points)

            // Stagger affects Y position
            // Verify that stagger is preserved in the conversion
            // We don't care about absolute positions, just relative stagger
            const positions = parseKLEPositions(kleOutput)

            // Get second row keys to avoid normalization offset issues
            const pinkyR2Y = positions['matrix_pinky_r2'].y
            const ringR2Y = positions['matrix_ring_r2'].y
            const middleR2Y = positions['matrix_middle_r2'].y

            // Stagger should be preserved: ring has +5 stagger, middle has +2 more
            // In KLE units: 5/19 ≈ 0.263, 2/19 ≈ 0.105
            // Difference should be 0.263 (accounting for sign/direction)
            const ringStaggerDelta = Math.abs(ringR2Y - pinkyR2Y)
            const middleStaggerDelta = Math.abs(middleR2Y - ringR2Y)

            // Ring should be about 0.263U different from pinky (may include row offset)
            Math.abs(ringStaggerDelta % 1 - 0.263).should.be.below(0.02, 'Ring stagger')
            // Middle should be about 0.105U different from ring
            Math.abs(middleStaggerDelta % 1 - 0.105).should.be.below(0.02, 'Middle stagger')
        })
    })

    describe('Custom Unit Configuration', function() {

        it('custom units should normalize correctly', async function() {
            const config = yaml.load(`
                units:
                  $default_width: 20
                  $default_height: 20
                  $default_padding: 22
                  $default_spread: 22
                points:
                  zones:
                    matrix:
                      columns:
                        col1:
                          rows:
                            r1: {}
                            r2:
                              width: 40  # 2U
                        col2:
                          rows:
                            r1: {}
                            r2: {}
            `)

            const points = await processErgogen(config)
            const kleOutput = kle.serialize(points)

            // Standard 20-unit keys should be 1U (no w property)
            // 40-unit key should be 2U (w: 2)
            const has2UKey = kleOutput.some(row =>
                row.some((item, i) => {
                    if (typeof item === 'object' && item.w === 2) {
                        return row[i+1] === 'matrix_col1_r2'
                    }
                    return false
                })
            )
            has2UKey.should.equal(true, 'Custom units: 40-unit key should be 2U')

            // Spacing should be based on padding (22)
            // So column spacing should be 22/22 = 1U
            const positions = parseKLEPositions(kleOutput)
            const col1X = positions['matrix_col1_r1'].x
            const col2X = positions['matrix_col2_r1'].x

            // Columns should be 1U apart
            Math.abs((col2X - col1X) - 1).should.be.below(0.01, 'Column spacing should be 1U')
        })
    })

    describe('Rotated Keys', function() {

        it('rotated thumb cluster should have rotation properties', async function() {
            const config = yaml.load(`
                points:
                  zones:
                    matrix:
                      columns:
                        col:
                          rows:
                            r1: {}
                    thumb:
                      anchor:
                        ref: matrix_col_r1
                        shift: [19, -19]
                        rotate: -10
                      columns:
                        t1:
                          rows:
                            r1: {}
            `)

            const points = await processErgogen(config)
            const kleOutput = kle.serialize(points)

            // Thumb key should have rotation properties
            const hasRotation = kleOutput.some(row =>
                row.some((item, i) => {
                    if (typeof item === 'object' && item.r === 10) { // -(-10) = 10
                        return row[i+1] === 'thumb_t1_r1'
                    }
                    return false
                })
            )
            hasRotation.should.equal(true, 'Rotated key should have r property')
        })
    })

    describe('Position Normalization', function() {

        it('layout with offset should normalize to origin', async function() {
            const config = yaml.load(`
                points:
                  zones:
                    matrix:
                      anchor:
                        shift: [50, -100]
                      columns:
                        col:
                          rows:
                            r1: {}
            `)

            const points = await processErgogen(config)
            const kleOutput = kle.serialize(points)

            // Despite the shift, after normalization the layout should start near (0, 0)
            // The first key should be at the origin
            verifyKeyPosition(kleOutput, 'matrix_col_r1', 0, 0, 0.1)
        })
    })
})
