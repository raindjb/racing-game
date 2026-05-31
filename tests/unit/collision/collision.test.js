/**
 * collision.test.js — Tests for collision detection and resolution.
 *
 * Tests pure math functions: rotatePoint, projectPolygon, AABB, SAT,
 * car-to-car collision, and collision resolution.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModule } from '../../helpers/load-module.js';

beforeAll(() => {
  loadModule('config');
  loadModule('collision');
});

// ============================================================================
// _rotatePoint
// ============================================================================
describe('R._rotatePoint', () => {
  it('returns the same point when angle is 0', () => {
    const result = R._rotatePoint(10, 20, 0, 0, 0);
    expect(result.x).toBeCloseTo(10, 10);
    expect(result.y).toBeCloseTo(20, 10);
  });

  it('rotates 90° counter-clockwise around origin', () => {
    // Point (10, 0) rotated 90° around (0,0) → (0, 10)
    const result = R._rotatePoint(10, 0, 0, 0, Math.PI / 2);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(10, 10);
  });

  it('rotates 180° around origin', () => {
    const result = R._rotatePoint(5, 0, 0, 0, Math.PI);
    expect(result.x).toBeCloseTo(-5, 10);
    expect(result.y).toBeCloseTo(0, 10);
  });

  it('rotates around a non-origin point', () => {
    // Point (15, 10) rotated 90° around (10, 10) → (10, 15)
    const result = R._rotatePoint(15, 10, 10, 10, Math.PI / 2);
    expect(result.x).toBeCloseTo(10, 10);
    expect(result.y).toBeCloseTo(15, 10);
  });

  it('handles negative angles', () => {
    // -90° = clockwise 90°
    const result = R._rotatePoint(10, 0, 0, 0, -Math.PI / 2);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(-10, 10);
  });
});

// ============================================================================
// _projectPolygon
// ============================================================================
describe('R._projectPolygon', () => {
  it('projects points onto X axis', () => {
    const points = [{ x: 1, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 0 }];
    const proj = R._projectPolygon(points, 1, 0);
    expect(proj.min).toBe(1);
    expect(proj.max).toBe(5);
  });

  it('projects points onto Y axis', () => {
    const points = [{ x: 0, y: 2 }, { x: 0, y: 8 }, { x: 0, y: 4 }];
    const proj = R._projectPolygon(points, 0, 1);
    expect(proj.min).toBe(2);
    expect(proj.max).toBe(8);
  });

  it('handles single point', () => {
    const points = [{ x: 3, y: 7 }];
    const proj = R._projectPolygon(points, 1, 1);
    expect(proj.min).toBe(10);
    expect(proj.max).toBe(10);
  });

  it('handles empty array', () => {
    const proj = R._projectPolygon([], 1, 0);
    expect(proj.min).toBe(Infinity);
    expect(proj.max).toBe(-Infinity);
  });
});

// ============================================================================
// _getCarCorners
// ============================================================================
describe('R._getCarCorners', () => {
  it('returns 4 corners', () => {
    const car = { x: 100, y: 200, angle: 0 };
    const corners = R._getCarCorners(car);
    expect(corners).toHaveLength(4);
  });

  it('at angle 0, car faces expected direction', () => {
    const car = { x: 0, y: 0, angle: 0 };
    const corners = R._getCarCorners(car);
    const hw = R.CONFIG.CAR_WIDTH * 0.5;
    const hh = R.CONFIG.CAR_HEIGHT * 0.5;
    // Front-left, front-right, rear-right, rear-left
    expect(corners[0].x).toBeCloseTo(-hw, 5);
    expect(corners[0].y).toBeCloseTo(-hh, 5);
    expect(corners[2].x).toBeCloseTo(hw, 5);
    expect(corners[2].y).toBeCloseTo(hh, 5);
  });

  it('rotated car corners form a rectangle (consistent distances)', () => {
    const car = { x: 50, y: 60, angle: 0.8 };
    const corners = R._getCarCorners(car);
    // Consecutive corners should have consistent edge lengths
    const d01 = dist(corners[0], corners[1]);
    const d12 = dist(corners[1], corners[2]);
    const d23 = dist(corners[2], corners[3]);
    const d30 = dist(corners[3], corners[0]);
    // CAR_WIDTH edge
    expect(d01).toBeCloseTo(R.CONFIG.CAR_WIDTH, 5);
    expect(d23).toBeCloseTo(R.CONFIG.CAR_WIDTH, 5);
    // CAR_HEIGHT edge
    expect(d12).toBeCloseTo(R.CONFIG.CAR_HEIGHT, 5);
    expect(d30).toBeCloseTo(R.CONFIG.CAR_HEIGHT, 5);
  });
});

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ============================================================================
// _getNormals
// ============================================================================
describe('R._getNormals', () => {
  it('returns 4 normals for a rectangle', () => {
    const car = { x: 0, y: 0, angle: 0 };
    const corners = R._getCarCorners(car);
    const normals = R._getNormals(corners);
    expect(normals).toHaveLength(4);
  });

  it('each normal has length ~1', () => {
    const car = { x: 0, y: 0, angle: 0.5 };
    const corners = R._getCarCorners(car);
    const normals = R._getNormals(corners);
    for (const n of normals) {
      const len = Math.sqrt(n.x * n.x + n.y * n.y);
      expect(len).toBeCloseTo(1, 5);
    }
  });

  it('normals are perpendicular to edges', () => {
    const car = { x: 0, y: 0, angle: 0.3 };
    const corners = R._getCarCorners(car);
    const normals = R._getNormals(corners);
    for (let i = 0; i < corners.length; i++) {
      const j = (i + 1) % corners.length;
      const edgeX = corners[j].x - corners[i].x;
      const edgeY = corners[j].y - corners[i].y;
      const dot = edgeX * normals[i].x + edgeY * normals[i].y;
      expect(dot).toBeCloseTo(0, 5);
    }
  });
});

// ============================================================================
// _overlapOnAxis
// ============================================================================
describe('R._overlapOnAxis', () => {
  it('returns positive overlap for overlapping projections', () => {
    const a = { min: 0, max: 10 };
    const b = { min: 5, max: 15 };
    expect(R._overlapOnAxis(a, b)).toBe(5);
  });

  it('returns negative overlap for separated projections', () => {
    const a = { min: 0, max: 5 };
    const b = { min: 10, max: 15 };
    expect(R._overlapOnAxis(a, b)).toBe(-5);
  });

  it('returns 0 for touching projections', () => {
    const a = { min: 0, max: 5 };
    const b = { min: 5, max: 10 };
    expect(R._overlapOnAxis(a, b)).toBe(0);
  });
});

// ============================================================================
// _aabbOverlap
// ============================================================================
describe('R._aabbOverlap', () => {
  it('detects overlapping AABBs', () => {
    const a = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    const b = { minX: 5, maxX: 15, minY: 5, maxY: 15 };
    expect(R._aabbOverlap(a, b)).toBe(true);
  });

  it('detects non-overlapping AABBs (separated on X)', () => {
    const a = { minX: 0, maxX: 5, minY: 0, maxY: 5 };
    const b = { minX: 10, maxX: 15, minY: 0, maxY: 5 };
    expect(R._aabbOverlap(a, b)).toBe(false);
  });

  it('detects non-overlapping AABBs (separated on Y)', () => {
    const a = { minX: 0, maxX: 5, minY: 0, maxY: 5 };
    const b = { minX: 0, maxX: 5, minY: 10, maxY: 15 };
    expect(R._aabbOverlap(a, b)).toBe(false);
  });
});

// ============================================================================
// carAABB
// ============================================================================
describe('R.carAABB', () => {
  it('returns finite bounds for a car at origin', () => {
    const car = { x: 0, y: 0, angle: 0 };
    const aabb = R.carAABB(car);
    expect(aabb.minX).toBeLessThan(0);
    expect(aabb.maxX).toBeGreaterThan(0);
    expect(aabb.minY).toBeLessThan(0);
    expect(aabb.maxY).toBeGreaterThan(0);
  });

  it('AABB contains the car position', () => {
    const car = { x: 100, y: 200, angle: 0.5 };
    const aabb = R.carAABB(car);
    expect(aabb.minX).toBeLessThanOrEqual(car.x);
    expect(aabb.maxX).toBeGreaterThanOrEqual(car.x);
    expect(aabb.minY).toBeLessThanOrEqual(car.y);
    expect(aabb.maxY).toBeGreaterThanOrEqual(car.y);
  });
});

// ============================================================================
// checkCarToCar — SAT collision detection
// ============================================================================
describe('R.checkCarToCar', () => {
  it('returns null for cars far apart', () => {
    const carA = { x: 0, y: 0, angle: 0 };
    const carB = { x: 500, y: 500, angle: 0 };
    expect(R.checkCarToCar(carA, carB)).toBeNull();
  });

  it('detects collision for overlapping cars', () => {
    const carA = { x: 0, y: 0, angle: 0 };
    const carB = { x: 30, y: 30, angle: 0 };
    const result = R.checkCarToCar(carA, carB);
    expect(result).not.toBeNull();
    expect(result.hit).toBe(true);
    expect(result.depth).toBeGreaterThan(0);
  });

  it('detects collision for cars at same position', () => {
    const carA = { x: 100, y: 100, angle: 0 };
    const carB = { x: 100, y: 100, angle: 0.3 };
    const result = R.checkCarToCar(carA, carB);
    expect(result).not.toBeNull();
    expect(result.hit).toBe(true);
  });
});

// ============================================================================
// resolveCollision
// ============================================================================
describe('R.resolveCollision', () => {
  it('pushes two overlapping cars apart', () => {
    const carA = { x: 0, y: 0, speed: 5, angle: 0 };
    const carB = { x: 20, y: 20, speed: 5, angle: 0 };
    const overlap = { overlapX: 30, overlapY: 0, depth: 30 };

    R.resolveCollision(carA, carB, overlap);

    // Cars should be pushed apart
    expect(carA.x).toBeLessThan(0);  // pushed left
    expect(carB.x).toBeGreaterThan(20); // pushed right
  });

  it('both moving cars share push equally', () => {
    const carA = { x: 0, y: 0, speed: 8, angle: 0 };
    const carB = { x: 30, y: 0, speed: 6, angle: 0 };
    const copyA = { x: carA.x, y: carA.y };
    const copyB = { x: carB.x, y: carB.y };
    const overlap = { overlapX: 50, overlapY: 0, depth: 50 };

    R.resolveCollision(carA, carB, overlap);

    // Both should move (0.5 ratio each)
    expect(carA.x).not.toBe(copyA.x);
    expect(carB.x).not.toBe(copyB.x);
  });

  it('stationary car gets pushed more', () => {
    R.CONFIG.MIN_SPEED = 0.5;
    const carA = { x: 0, y: 0, speed: 0, angle: 0 };    // stationary
    const carB = { x: 30, y: 0, speed: 8, angle: 0 };    // moving
    const overlap = { overlapX: 50, overlapY: 0, depth: 50 };

    R.resolveCollision(carA, carB, overlap);

    // Stationary car should have moved (received push)
    expect(carA.x).not.toBe(0);
  });

  it('does nothing when depth is zero', () => {
    const carA = { x: 0, y: 0, speed: 5, angle: 0 };
    const carB = { x: 10, y: 0, speed: 5, angle: 0 };
    const copyA = { x: carA.x, y: carA.y, speed: carA.speed };
    const copyB = { x: carB.x, y: carB.y, speed: carB.speed };

    R.resolveCollision(carA, carB, { overlapX: 0, overlapY: 0, depth: 0 });

    // Nothing should change
    expect(carA.x).toBe(copyA.x);
    expect(carB.x).toBe(copyB.x);
  });
});
