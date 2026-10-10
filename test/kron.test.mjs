import test from 'node:test';
import assert from 'node:assert/strict';
import { kronReduce, resistorLaplacian } from '../dist/index.js';

const finiteMatrix = matrix => matrix.every(row => row.every(Number.isFinite));

test('Kron edge IDs must be nonempty strings in both entry points', () => {
  for (const id of [undefined, null, '', 0, 7, false, true, {}, [], ['R'], new String('R')]) {
    const network = { nodes: ['a', 'b'], edges: [{ id, p: 'a', n: 'b', resistance: 1 }] };
    assert.throws(() => resistorLaplacian(network), RangeError);
    assert.throws(() => kronReduce(network, ['a', 'b']), RangeError);
  }
  const network = { nodes: ['a', 'b'], edges: [{ id: '0', p: 'a', n: 'b', resistance: 1 }] };
  assert.deepEqual(resistorLaplacian(network), [[1, -1], [-1, 1]]);
  assert.equal(kronReduce(network, ['a', 'b']).status, 'ok');
});

test('Kron rejects reciprocal conductance overflow from a positive finite resistance', () => {
  const network = { nodes: ['a', 'hidden'], edges: [{ id: 'R', p: 'a', n: 'hidden', resistance: Number.MIN_VALUE }] };
  assert.ok(Number.isFinite(network.edges[0].resistance) && network.edges[0].resistance > 0);
  assert.throws(() => resistorLaplacian(network), { name: 'RangeError', message: /conductance/i });
  for (const retained of [['a', 'hidden'], ['a']])
    assert.throws(() => kronReduce(network, retained), { name: 'RangeError', message: /conductance/i });
});

test('Kron rejects assembled overflow even when the internal block is finite and invertible', () => {
  // Each conductance is finite, but the parallel retained-edge sum overflows.
  // The hidden node has the well-conditioned internal block [1], so relying
  // on the internal solver alone used to return ok with an infinite response.
  const network = { nodes: ['a', 'b', 'hidden'], edges: [
    { id: 'R1', p: 'a', n: 'b', resistance: 1e-308 },
    { id: 'R2', p: 'a', n: 'b', resistance: 1e-308 },
    { id: 'R3', p: 'a', n: 'hidden', resistance: 1 },
  ] };
  assert.ok(network.edges.every(edge => Number.isFinite(1 / edge.resistance)));
  assert.throws(() => resistorLaplacian(network), { name: 'RangeError', message: /nonfinite.*Laplacian/i });
  for (const retained of [['a', 'b', 'hidden'], ['a', 'b']])
    assert.throws(() => kronReduce(network, retained), { name: 'RangeError', message: /nonfinite.*Laplacian/i });
});

test('Kron reports Schur overflow after eliminating internal nodes from a finite matrix', () => {
  // One boundary and two internal nodes: the exact terminal response is zero.
  // Near MAX_VALUE, rounding in the internal solve makes the Schur sum exceed
  // the floating-point range even though every full Laplacian entry is finite.
  const network = { nodes: ['a', 'x', 'y'], edges: [
    { id: 'ax', p: 'a', n: 'x', resistance: 1 / (Number.MAX_VALUE * .11) },
    { id: 'ay', p: 'a', n: 'y', resistance: 1 / (Number.MAX_VALUE * (1 - .11)) },
    { id: 'xy', p: 'x', n: 'y', resistance: 1 / (Number.MAX_VALUE * .07) },
  ] };
  assert.ok(finiteMatrix(resistorLaplacian(network)));
  const result = kronReduce(network, ['a']);
  assert.equal(result.status, 'ill-conditioned');
  assert.match(result.message, /nonfinite.*Schur/i);
  assert.equal(result.rank, 2);
  assert.equal(result.size, 2);
  assert.equal('reduced' in result, false);
});

test('Kron keeps finite large-conductance results with and without elimination', () => {
  const network = { nodes: ['a', 'hidden', 'b'], edges: [
    { id: 'R1', p: 'a', n: 'hidden', resistance: 1e-307 },
    { id: 'R2', p: 'hidden', n: 'b', resistance: 1e-307 },
  ] };
  for (const retained of [network.nodes, ['a', 'b']]) {
    const result = kronReduce(network, retained);
    assert.equal(result.status, 'ok', result.message);
    assert.ok(finiteMatrix(result.full));
    assert.ok(finiteMatrix(result.reduced));
    if (retained.length === 2) {
      assert.deepEqual(result.eliminated, ['hidden']);
      const expected = 1 / (2e-307); // Independent series-resistance law.
      result.reduced.forEach((row, i) => row.forEach((value, j) =>
        assert.ok(Math.abs(value / expected - (i === j ? 1 : -1)) < 1e-14)));
    } else assert.deepEqual(result.reduced, result.full);
  }
});
