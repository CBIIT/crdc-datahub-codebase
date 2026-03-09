import userEvent from "@testing-library/user-event";
import { Link, Route, Routes } from "react-router-dom";

import { TestRouter, render, screen, waitFor } from "../../test-utils";

import { SearchParamsProvider, useSearchParamsContext } from "./SearchParamsContext";

const TestChild = () => {
  const { searchParams, setSearchParams, lastSearchParams } = useSearchParamsContext();

  return (
    <>
      <div data-testid="current-query">{searchParams?.toString()}</div>
      <div data-testid="last-search-params">{JSON.stringify(lastSearchParams)}</div>
      <button
        type="button"
        onClick={() => setSearchParams(new URLSearchParams({ page: "2" }), { replace: true })}
      >
        Set Page
      </button>
      <button
        type="button"
        onClick={() =>
          setSearchParams((prev) => {
            prev.set("display", "2");
            return prev;
          })
        }
      >
        Add Display
      </button>
      <button type="button" onClick={() => setSearchParams(new URLSearchParams({ other: "foo" }))}>
        Set Other
      </button>
      <button
        type="button"
        onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
      >
        Clear Params
      </button>
      <Link to="/test?link=true">Go to test page</Link>
      <Link to="/test">Go to test page without search params</Link>
      <Link to="/another?link=true">Go to another page</Link>
    </>
  );
};

const TestParent = ({ initialEntries = ["/test?initial=true"] }) => (
  <TestRouter initialEntries={initialEntries}>
    <SearchParamsProvider>
      <Routes>
        <Route path="/test" element={<TestChild />} />
        <Route path="/another" element={<TestChild />} />
      </Routes>
    </SearchParamsProvider>
  </TestRouter>
);

describe("SearchParamsContext", () => {
  it("initializes with provided search parameters", () => {
    render(<TestChild />, { wrapper: () => <TestParent /> });
    expect(screen.getByTestId("current-query").textContent).toBe("initial=true");
  });

  it("updates search parameters correctly", async () => {
    render(<TestChild />, { wrapper: () => <TestParent /> });

    userEvent.click(screen.getByText("Set Page"));

    await waitFor(() => {
      expect(screen.getByTestId("current-query").textContent).toBe("page=2");
    });

    userEvent.click(screen.getByText("Set Other"));

    await waitFor(() => {
      expect(screen.getByTestId("current-query").textContent).toContain("other=foo");
    });
  });

  it("clears search parameters correctly", async () => {
    render(<TestChild />, { wrapper: () => <TestParent /> });

    userEvent.click(screen.getByText("Clear Params"));

    await waitFor(() => {
      expect(screen.getByTestId("current-query").textContent).toBe("");
    });
  });

  it("initializes and retains initial search parameters", () => {
    render(<TestChild />, { wrapper: () => <TestParent /> });
    expect(screen.getByTestId("current-query").textContent).toBe("initial=true");
    expect(screen.getByTestId("last-search-params").textContent).toBe('{"/test":"?initial=true"}');
  });

  it("updates lastSearchParams when navigating with new parameters", async () => {
    render(<TestChild />, {
      wrapper: () => <TestParent initialEntries={["/test?test=true", "/another?updated=true"]} />,
    });

    userEvent.click(screen.getByText("Add Display"));

    await waitFor(() => {
      expect(screen.getByTestId("last-search-params").textContent).toContain(
        '{"/another":"?updated=true&display=2"}'
      );
    });

    userEvent.click(screen.getByText("Go to test page"));

    await waitFor(() => {
      expect(screen.getByTestId("last-search-params").textContent).toContain(
        '{"/another":"?updated=true&display=2","/test":"?link=true"}'
      );
    });
  });

  it("should not update lastSearchParams when value is the same", async () => {
    render(<TestChild />, {
      wrapper: () => <TestParent initialEntries={["/another?page=2"]} />,
    });

    userEvent.click(screen.getByText("Set Page"));

    await waitFor(() => {
      expect(screen.getByTestId("current-query").textContent).toBe("page=2");
      expect(screen.getByTestId("last-search-params").textContent).toContain(
        '{"/another":"?page=2"}'
      );
    });
  });

  it("should not update lastSearchParams with empty string before it has previously been assigned", async () => {
    render(<TestChild />, {
      wrapper: () => <TestParent initialEntries={["/another?initial=true"]} />,
    });

    userEvent.click(screen.getByText("Go to test page without search params"));

    await waitFor(() => {
      expect(screen.getByTestId("current-query").textContent).toBe("");
      expect(screen.getByTestId("last-search-params").textContent).toContain(
        '{"/another":"?initial=true"}'
      );
    });
  });

  it("updates lastSearchParams with empty string after it has previously been assigned", async () => {
    render(<TestChild />, {
      wrapper: () => <TestParent initialEntries={["/another?initial=true"]} />,
    });

    userEvent.click(screen.getByText("Set Page"));
    userEvent.click(screen.getByText("Go to test page"));
    userEvent.click(screen.getByText("Set Other"));

    await waitFor(() => {
      expect(screen.getByTestId("current-query").textContent).toBe("other=foo");
      expect(screen.getByTestId("last-search-params").textContent).toContain(
        '{"/another":"?page=2","/test":"?other=foo"}'
      );
    });

    userEvent.click(screen.getByText("Go to another page"));
    userEvent.click(screen.getByText("Go to test page without search params"));

    await waitFor(() => {
      expect(screen.getByTestId("current-query").textContent).toBe("");
      expect(screen.getByTestId("last-search-params").textContent).toContain(
        '{"/another":"?link=true","/test":""}'
      );
    });
  });

  it("throws an error when used outside of provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestChild />)).toThrow(
      "useSearchParamsContext cannot be used outside of the SearchParamsProvider component"
    );
    consoleSpy.mockRestore();
  });
});
