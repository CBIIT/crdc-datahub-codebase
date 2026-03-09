import { renderHook, act } from "../test-utils";

import { useDelayedLoading } from "./useDelayedLoading";

describe("useDelayedLoading", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("should not show loading initially even when isLoading is true", () => {
    const { result } = renderHook(() => useDelayedLoading(true, 1000));
    expect(result.current).toBe(false);
  });

  it("should show loading after a delay of 1000ms", () => {
    const { result } = renderHook(() => useDelayedLoading(true, 1000));
    act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false); // still not shown just before the delay
    act(() => vi.advanceTimersByTime(1)); // exact moment the delay completes
    expect(result.current).toBe(true);
  });

  it("should not show loading if isLoading becomes false before the delay is reached", () => {
    const { result, rerender } = renderHook(useDelayedLoading, {
      initialProps: true,
    });

    rerender(false);
    act(() => vi.advanceTimersByTime(500)); // before the delay
    expect(result.current).toBe(false); // ensure it remains false

    act(() => vi.advanceTimersByTime(500)); // surpass the original delay
    expect(result.current).toBe(false);
  });

  it("should clean up on component unmount to prevent memory leaks", () => {
    const { unmount } = renderHook(() => useDelayedLoading(true, 1000));
    const spy = vi.spyOn(global, "clearTimeout");
    unmount();
    expect(spy).toHaveBeenCalled(); // Verify that clearTimeout is called upon unmount
    act(() => vi.advanceTimersByTime(1000));
    spy.mockRestore();
  });

  it("should not show loading when rapidly toggled off and on within the delay period", () => {
    const { result, rerender } = renderHook(useDelayedLoading, {
      initialProps: true,
    });

    rerender(false);
    act(() => vi.advanceTimersByTime(50));
    rerender(true);
    act(() => vi.advanceTimersByTime(50)); // Total 100ms, half the delay
    expect(result.current).toBe(false);

    rerender(false);
    act(() => vi.advanceTimersByTime(150)); // 100ms into the next toggle, but was turned off
    expect(result.current).toBe(false);
  });

  it("should maintain state isolation between mounting sessions", () => {
    const { result, unmount } = renderHook(useDelayedLoading, {
      initialProps: true,
    });

    act(() => vi.advanceTimersByTime(199));
    expect(result.current).toBe(false);
    unmount();

    const { result: newResult } = renderHook(() => useDelayedLoading(true));
    act(() => vi.advanceTimersByTime(200));
    expect(newResult.current).toBe(true); // New instance should also respect the delay
  });

  it("should not show loading if toggled off exactly at the delay time", () => {
    const { result, rerender } = renderHook(useDelayedLoading, {
      initialProps: true,
    });

    act(() => vi.advanceTimersByTime(999));
    rerender(false);
    act(() => vi.advanceTimersByTime(1)); // Should be exactly at delay, but toggled off
    expect(result.current).toBe(false);
  });

  it("should not show loading if isLoading stays false", () => {
    const { result } = renderHook(() => useDelayedLoading(false));
    act(() => vi.advanceTimersByTime(1500)); // Exceeding the delay
    expect(result.current).toBe(false); // Should still be false as it never turned true
  });
});
