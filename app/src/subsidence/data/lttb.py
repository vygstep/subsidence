from __future__ import annotations

import numpy as np


def lttb(depths: np.ndarray, values: np.ndarray, threshold: int) -> np.ndarray:
    """
    Largest-Triangle-Three-Buckets downsampling.
    Returns integer indices of retained samples.
    Always retains first and last sample.
    """
    n = len(depths)
    if n <= threshold:
        return np.arange(n)

    every = (n - 2) / (threshold - 2)
    indices = [0]
    a = 0
    for i in range(threshold - 2):
        avg_start = int((i + 1) * every) + 1
        avg_end = int((i + 2) * every) + 1
        avg_x = depths[avg_start:avg_end].mean()
        avg_y = values[avg_start:avg_end].mean()

        range_start = int(i * every) + 1
        range_end = int((i + 1) * every) + 1
        max_area = -1.0
        next_a = range_start
        ax, ay = depths[a], values[a]
        for j in range(range_start, range_end):
            area = abs(
                (ax - avg_x) * (values[j] - ay)
                - (ax - depths[j]) * (avg_y - ay)
            )
            if area > max_area:
                max_area = area
                next_a = j
        indices.append(next_a)
        a = next_a

    indices.append(n - 1)
    return np.array(indices, dtype=np.intp)
