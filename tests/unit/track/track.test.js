/**
 * track.test.js — Tests for track generation and spatial queries.
 *
 * Tests: forwardDist, getTrackPosition, isOnTrack, worldToScreen,
 * Catmull-Rom interpolation.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModule } from '../../helpers/load-module.js';

beforeAll(() => {
  loadModule('config');
  loadModule('track');
});

// ============================================================================
// R.worldToScreen — perspective projection
// ============================================================================
describe('R.worldToScreen', () => {
  it('returns input coords when camera is null', () => {
    const oldCam = R.camera;
    R.camera = null;
    const result = R.worldToScreen(100, 200, 300);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
    expect(result.scale).toBe(1);
    R.camera = oldCam;
  });

  it('maps camera position to screen center', () => {
    R.camera = { x: 0, y: 0, zoom: 1 };
    const W = R.CONFIG.CANVAS_WIDTH;
    const H = R.CONFIG.CANVAS_HEIGHT;
    const result = R.worldToScreen(0, 0, 0);
    expect(result.x).toBeCloseTo(W / 2, 1);
    expect(result.y).toBeCloseTo(H / 2, 1);
  });

  it('scales with zoom', () => {
    R.camera = { x: 0, y: 0, zoom: 2 };
    const result = R.worldToScreen(100, 0, 0);
    const cx = R.CONFIG.CANVAS_WIDTH / 2;
    expect(result.x).toBeCloseTo(cx + 100 * 2, 1);
  });

  it('shifts with camera position', () => {
    R.camera = { x: 200, y: 100, zoom: 1 };
    const W = R.CONFIG.CANVAS_WIDTH;
    const H = R.CONFIG.CANVAS_HEIGHT;
    // World point at camera position → screen center
    const result = R.worldToScreen(200, 100, 0);
    expect(result.x).toBeCloseTo(W / 2, 1);
    expect(result.y).toBeCloseTo(H / 2, 1);
  });
});

// ============================================================================
// R.initTrack — procedural track generation
// ============================================================================
describe('R.initTrack', () => {
  beforeAll(() => {
    R.camera = { x: 0, y: 0, zoom: 1 };
    R.initTrack();
  });

  it('generates segments', () => {
    expect(R.track).toBeDefined();
    expect(R.track.segments).toBeDefined();
    expect(R.track.segments.length).toBeGreaterThan(0);
  });

  it('generates correct number of segments', () => {
    const expected = R.CONFIG.TRACK_CONTROL_POINTS * R.CONFIG.TRACK_SEGMENTS_PER_CP;
    expect(R.track.segments.length).toBe(expected);
  });

  it('totalLength is positive', () => {
    expect(R.track.totalLength).toBeGreaterThan(0);
  });

  it('track is closed: first and last segments are near each other', () => {
    const first = R.track.segments[0];
    const last = R.track.segments[R.track.segments.length - 1];
    const dx = first.worldX - last.worldX;
    const dz = first.worldZ - last.worldZ;
    const gap = Math.sqrt(dx * dx + dz * dz);
    // Catmull-Rom spline closing gap should be small
    expect(gap).toBeLessThan(R.track.totalLength * 0.1);
  });

  it('each segment has required fields', () => {
    const seg = R.track.segments[0];
    expect(seg).toHaveProperty('worldX');
    expect(seg).toHaveProperty('worldY');
    expect(seg).toHaveProperty('worldZ');
    expect(seg).toHaveProperty('width');
    expect(seg).toHaveProperty('curvature');
    expect(seg).toHaveProperty('type');
    expect(seg).toHaveProperty('dist');
    expect(seg).toHaveProperty('angle');
  });

  it('segment distances are monotonically increasing', () => {
    const segs = R.track.segments;
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].dist).toBeGreaterThan(segs[i - 1].dist);
    }
  });

  it('sets start position from first segment', () => {
    const seg0 = R.track.segments[0];
    expect(R.track.startX).toBe(seg0.worldX);
    expect(R.track.startZ).toBe(seg0.worldZ);
  });

  it('generates checkpoints', () => {
    expect(R.track.checkpoints).toBeDefined();
    expect(R.track.checkpoints.length).toBe(R.CONFIG.LAP_CHECKPOINT_COUNT);
  });
});

// ============================================================================
// R.getTrackPosition — interpolated position lookup
// ============================================================================
describe('R.getTrackPosition', () => {
  beforeAll(() => {
    if (!R.track || !R.track.segments) {
      R.camera = { x: 0, y: 0, zoom: 1 };
      R.initTrack();
    }
  });

  it('returns a position at distance 0', () => {
    const pos = R.getTrackPosition(0);
    expect(pos).toBeDefined();
    expect(pos.x).toBeDefined();
    expect(pos.z).toBeDefined();
    expect(pos.index).toBeGreaterThanOrEqual(0);
  });

  it('wraps around totalLength', () => {
    const total = R.track.totalLength;
    const posA = R.getTrackPosition(0);
    const posB = R.getTrackPosition(total);
    expect(posB.dist).toBeCloseTo(0, 5);
  });

  it('handles negative distance', () => {
    const total = R.track.totalLength;
    const posA = R.getTrackPosition(-100);
    const posB = R.getTrackPosition(total - 100);
    expect(posA.index).toBe(posB.index);
  });

  it('interpolates between segments', () => {
    const segs = R.track.segments;
    const midDist = (segs[0].dist + segs[1].dist) / 2;
    const pos = R.getTrackPosition(midDist);
    // Should be between the two segments
    expect(pos.index).toBe(0);
  });

  it('has a valid angle at any position', () => {
    for (let i = 0; i < 5; i++) {
      const dist = (i / 5) * R.track.totalLength;
      const pos = R.getTrackPosition(dist);
      expect(Number.isFinite(pos.angle)).toBe(true);
    }
  });
});

// ============================================================================
// R.isOnTrack — position validation
// ============================================================================
describe('R.isOnTrack', () => {
  beforeAll(() => {
    if (!R.track || !R.track.segments) {
      R.camera = { x: 0, y: 0, zoom: 1 };
      R.initTrack();
    }
  });

  it('start position is on track', () => {
    const result = R.isOnTrack(R.track.startX, R.track.startZ);
    expect(result.onTrack).toBe(true);
  });

  it('position far away is off track', () => {
    const result = R.isOnTrack(99999, 99999);
    expect(result.onTrack).toBe(false);
  });

  it('returns segmentIndex and halfWidth', () => {
    const result = R.isOnTrack(R.track.startX, R.track.startZ);
    expect(result.segmentIndex).toBeGreaterThanOrEqual(0);
    expect(result.halfWidth).toBeGreaterThan(0);
  });

  it('distance from center at start is near 0', () => {
    const result = R.isOnTrack(R.track.startX, R.track.startZ);
    expect(result.distFromCenter).toBeLessThan(5);
  });

  it('position offset laterally is off track', () => {
    const seg0 = R.track.segments[0];
    const farOffset = seg0.width * 2; // way outside
    const testX = seg0.worldX + farOffset;
    const result = R.isOnTrack(testX, seg0.worldZ);
    expect(result.onTrack).toBe(false);
  });
});

// ============================================================================
// R.getSegmentAtDistance — direct segment access
// ============================================================================
describe('R.getSegmentAtDistance', () => {
  beforeAll(() => {
    if (!R.track || !R.track.segments) {
      R.camera = { x: 0, y: 0, zoom: 1 };
      R.initTrack();
    }
  });

  it('returns first segment at distance 0', () => {
    const seg = R.getSegmentAtDistance(0);
    expect(seg).toBe(R.track.segments[0]);
  });

  it('wraps correctly', () => {
    const segA = R.getSegmentAtDistance(0);
    const segB = R.getSegmentAtDistance(R.track.totalLength);
    expect(segA).toBe(segB);
  });
});

// ============================================================================
// R.getTrackWidth — convenience lookup
// ============================================================================
describe('R.getTrackWidth', () => {
  it('returns a positive width', () => {
    const w = R.getTrackWidth(0);
    expect(w).toBeGreaterThan(0);
  });
});
