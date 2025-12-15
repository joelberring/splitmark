/**
 * Affine Transformation Library for Map Georeferencing
 * 
 * Implements the 6-parameter affine transformation:
 * X = Ax + By + C
 * Y = Dx + Ey + F
 * 
 * Where (x, y) = pixel coordinates
 *       (X, Y) = geographic coordinates (lat/lon or projected)
 */

// ============================================================================
// Types
// ============================================================================

export interface Point {
    x: number;
    y: number;
}

export interface GeoPoint {
    lat: number;
    lon: number;
}

/**
 * Ground Control Point - pairs a pixel location with a geographic location
 */
export interface GCP {
    id: string;
    pixel: Point;
    geo: GeoPoint;
}

/**
 * Affine transformation matrix parameters
 * 
 * | a  b  c |   | x |   | X |
 * | d  e  f | × | y | = | Y |
 *               | 1 |
 */
export interface AffineMatrix {
    a: number;  // Scale X / Rotation
    b: number;  // Shear X / Rotation
    c: number;  // Translation X (offset)
    d: number;  // Shear Y / Rotation
    e: number;  // Scale Y / Rotation
    f: number;  // Translation Y (offset)
}

export interface CalibrationResult {
    matrix: AffineMatrix;
    residuals: number[];      // Error per GCP in geographic units
    rmsError: number;         // Root Mean Square error
    isValid: boolean;
    errorMessage?: string;
}

// ============================================================================
// Core Mathematical Functions
// ============================================================================

/**
 * Solves for the affine transformation matrix given 3 or more GCPs.
 * 
 * For exactly 3 GCPs: Uses direct matrix inversion (exact solution)
 * For 4+ GCPs: Uses least squares for overdetermined system (more accurate)
 * 
 * @param gcps Array of Ground Control Points (minimum 3)
 * @returns CalibrationResult with matrix and quality metrics
 */
export function solveAffine(gcps: GCP[]): CalibrationResult {
    if (gcps.length < 3) {
        return {
            matrix: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 },
            residuals: [],
            rmsError: Infinity,
            isValid: false,
            errorMessage: 'Minimum 3 Ground Control Points required'
        };
    }

    const n = gcps.length;

    // Build the coefficient matrix A and target vectors for X (lon) and Y (lat)
    // Each GCP gives us two equations:
    // lon = a*x + b*y + c
    // lat = d*x + e*y + f

    // For least squares: A^T * A * params = A^T * target

    // Matrix A: [x, y, 1] for each GCP
    const A: number[][] = gcps.map(gcp => [gcp.pixel.x, gcp.pixel.y, 1]);

    // Target vectors
    const targetLon: number[] = gcps.map(gcp => gcp.geo.lon);
    const targetLat: number[] = gcps.map(gcp => gcp.geo.lat);

    try {
        // Solve for longitude coefficients (a, b, c)
        const lonCoeffs = solveLeastSquares(A, targetLon);

        // Solve for latitude coefficients (d, e, f)
        const latCoeffs = solveLeastSquares(A, targetLat);

        const matrix: AffineMatrix = {
            a: lonCoeffs[0],
            b: lonCoeffs[1],
            c: lonCoeffs[2],
            d: latCoeffs[0],
            e: latCoeffs[1],
            f: latCoeffs[2]
        };

        // Calculate residuals (errors) for each GCP
        const residuals = gcps.map(gcp => {
            const predicted = applyAffine(matrix, gcp.pixel);
            const dx = predicted.lon - gcp.geo.lon;
            const dy = predicted.lat - gcp.geo.lat;
            return Math.sqrt(dx * dx + dy * dy);
        });

        // RMS Error
        const rmsError = Math.sqrt(
            residuals.reduce((sum, r) => sum + r * r, 0) / n
        );

        return {
            matrix,
            residuals,
            rmsError,
            isValid: true
        };

    } catch (error) {
        return {
            matrix: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 },
            residuals: [],
            rmsError: Infinity,
            isValid: false,
            errorMessage: error instanceof Error ? error.message : 'Matrix computation failed'
        };
    }
}

/**
 * Applies the affine transformation to convert pixel coords to geo coords
 */
export function applyAffine(matrix: AffineMatrix, pixel: Point): GeoPoint {
    return {
        lon: matrix.a * pixel.x + matrix.b * pixel.y + matrix.c,
        lat: matrix.d * pixel.x + matrix.e * pixel.y + matrix.f
    };
}

/**
 * Applies the affine transformation in batch (more efficient for many points)
 */
export function applyAffineBatch(matrix: AffineMatrix, pixels: Point[]): GeoPoint[] {
    return pixels.map(p => applyAffine(matrix, p));
}

/**
 * Inverts the affine transformation to convert geo coords to pixel coords
 */
export function invertAffine(matrix: AffineMatrix): AffineMatrix | null {
    // For 2D affine: need to invert the 2x2 submatrix and adjust translation
    // | a  b |^-1 = 1/det * | e  -b |
    // | d  e |              | -d  a |

    const det = matrix.a * matrix.e - matrix.b * matrix.d;

    if (Math.abs(det) < 1e-10) {
        return null; // Singular matrix
    }

    const invDet = 1 / det;

    // Inverted scale/rotation
    const aInv = matrix.e * invDet;
    const bInv = -matrix.b * invDet;
    const dInv = -matrix.d * invDet;
    const eInv = matrix.a * invDet;

    // Inverted translation
    const cInv = -(aInv * matrix.c + bInv * matrix.f);
    const fInv = -(dInv * matrix.c + eInv * matrix.f);

    return {
        a: aInv,
        b: bInv,
        c: cInv,
        d: dInv,
        e: eInv,
        f: fInv
    };
}

/**
 * Convert geo coords back to pixel coords using inverted matrix
 */
export function geoToPixel(matrix: AffineMatrix, geo: GeoPoint): Point | null {
    const inverse = invertAffine(matrix);
    if (!inverse) return null;

    return {
        x: inverse.a * geo.lon + inverse.b * geo.lat + inverse.c,
        y: inverse.d * geo.lon + inverse.e * geo.lat + inverse.f
    };
}

// ============================================================================
// Matrix Math Utilities (No external dependencies)
// ============================================================================

/**
 * Solves least squares problem: A * x = b
 * Uses normal equations: (A^T * A) * x = A^T * b
 */
function solveLeastSquares(A: number[][], b: number[]): number[] {
    const m = A.length;    // Number of equations (GCPs)
    const n = A[0].length; // Number of unknowns (3: a, b, c or d, e, f)

    // Compute A^T * A (n x n matrix)
    const AtA: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let k = 0; k < m; k++) {
                sum += A[k][i] * A[k][j];
            }
            AtA[i][j] = sum;
        }
    }

    // Compute A^T * b (n x 1 vector)
    const Atb: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = 0; k < m; k++) {
            sum += A[k][i] * b[k];
        }
        Atb[i] = sum;
    }

    // Solve AtA * x = Atb using Gaussian elimination with pivoting
    return solveLinearSystem(AtA, Atb);
}

/**
 * Solves linear system Ax = b using Gaussian elimination with partial pivoting
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;

    // Create augmented matrix [A | b]
    const aug: number[][] = A.map((row, i) => [...row, b[i]]);

    // Forward elimination with partial pivoting
    for (let col = 0; col < n; col++) {
        // Find pivot
        let maxRow = col;
        let maxVal = Math.abs(aug[col][col]);
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(aug[row][col]) > maxVal) {
                maxVal = Math.abs(aug[row][col]);
                maxRow = row;
            }
        }

        // Check for singular matrix
        if (maxVal < 1e-10) {
            throw new Error('GCPs are collinear or nearly collinear - cannot compute transformation');
        }

        // Swap rows
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

        // Eliminate column below pivot
        for (let row = col + 1; row < n; row++) {
            const factor = aug[row][col] / aug[col][col];
            for (let j = col; j <= n; j++) {
                aug[row][j] -= factor * aug[col][j];
            }
        }
    }

    // Back substitution
    const x: number[] = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let sum = aug[i][n];
        for (let j = i + 1; j < n; j++) {
            sum -= aug[i][j] * x[j];
        }
        x[i] = sum / aug[i][i];
    }

    return x;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extracts transformation metadata (scale, rotation, skew)
 */
export function getTransformationInfo(matrix: AffineMatrix): {
    scaleX: number;
    scaleY: number;
    rotation: number;  // In degrees
    skewX: number;
    skewY: number;
} {
    const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.d * matrix.d);
    const scaleY = Math.sqrt(matrix.b * matrix.b + matrix.e * matrix.e);
    const rotation = Math.atan2(matrix.d, matrix.a) * (180 / Math.PI);

    return {
        scaleX,
        scaleY,
        rotation,
        skewX: Math.atan2(matrix.b, matrix.e) * (180 / Math.PI) + 90,
        skewY: 0
    };
}

/**
 * Creates a simple scale + translate transformation (no rotation)
 * Useful for quick previews
 */
export function createSimpleTransform(
    pixelBounds: { minX: number; maxX: number; minY: number; maxY: number },
    geoBounds: { minLon: number; maxLon: number; minLat: number; maxLat: number }
): AffineMatrix {
    const scaleX = (geoBounds.maxLon - geoBounds.minLon) / (pixelBounds.maxX - pixelBounds.minX);
    const scaleY = (geoBounds.minLat - geoBounds.maxLat) / (pixelBounds.maxY - pixelBounds.minY); // Inverted Y

    return {
        a: scaleX,
        b: 0,
        c: geoBounds.minLon - scaleX * pixelBounds.minX,
        d: 0,
        e: scaleY,
        f: geoBounds.maxLat - scaleY * pixelBounds.minY
    };
}

/**
 * Validates that a matrix is reasonable (no extreme values)
 */
export function validateMatrix(matrix: AffineMatrix): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    const info = getTransformationInfo(matrix);

    // Check for extreme scale
    if (info.scaleX < 1e-10 || info.scaleX > 1e10) {
        warnings.push('Extreme X scale detected - GCPs may be incorrect');
    }
    if (info.scaleY < 1e-10 || info.scaleY > 1e10) {
        warnings.push('Extreme Y scale detected - GCPs may be incorrect');
    }

    // Check for unreasonable rotation
    if (Math.abs(info.rotation) > 45) {
        warnings.push(`Rotation of ${info.rotation.toFixed(1)}° detected - verify GCP placement`);
    }

    return {
        valid: warnings.length === 0,
        warnings
    };
}

/**
 * Serialize matrix for storage (e.g., localStorage, Firestore)
 */
export function serializeMatrix(matrix: AffineMatrix): string {
    return JSON.stringify(matrix);
}

/**
 * Deserialize matrix from storage
 */
export function deserializeMatrix(json: string): AffineMatrix | null {
    try {
        const parsed = JSON.parse(json);
        if (
            typeof parsed.a === 'number' &&
            typeof parsed.b === 'number' &&
            typeof parsed.c === 'number' &&
            typeof parsed.d === 'number' &&
            typeof parsed.e === 'number' &&
            typeof parsed.f === 'number'
        ) {
            return parsed as AffineMatrix;
        }
        return null;
    } catch {
        return null;
    }
}
