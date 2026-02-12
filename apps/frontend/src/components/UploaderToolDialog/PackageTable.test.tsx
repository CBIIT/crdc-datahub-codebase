import { FC } from "react";
import { axe } from "vitest-axe";

import packageConfig from "../../config/PackageTableConfig";
import { TestRouter, render } from "../../test-utils";

import PackageTable from "./PackageTable";

vi.mock(import("../../env"), async (importOriginal) => {
  const mod = await importOriginal();

  return {
    default: {
      ...mod.default,
      VITE_UPLOADER_CLI: "https://github.com/.../fake-release/crdc-datahub-cli-uploader.zip",
      VITE_UPLOADER_CLI_WINDOWS:
        "https://github.com/.../fake-release/crdc-datahub-cli-uploader-windows.zip",
      VITE_UPLOADER_CLI_MAC_X64:
        "https://github.com/.../fake-release/crdc-datahub-cli-uploader-mac-x64.zip",
      VITE_UPLOADER_CLI_MAC_ARM:
        "https://github.com/.../fake-release/crdc-datahub-cli-uploader-mac-arm.zip",
    },
  };
});

type ParentProps = {
  children: React.ReactNode;
};

const TestParent: FC<ParentProps> = ({ children }) => (
  <TestRouter basename="">{children}</TestRouter>
);

describe("Accessibility", () => {
  it("should have no violations", async () => {
    const { container } = render(
      <TestParent>
        <PackageTable />
      </TestParent>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Basic Functionality", () => {
  it("should render without crashing", () => {
    const { getByTestId } = render(
      <TestParent>
        <PackageTable />
      </TestParent>
    );

    expect(getByTestId("package-table-container")).toBeVisible();
  });

  it("should render all rows correctly with CLI download links", () => {
    const { getByTestId } = render(
      <TestParent>
        <PackageTable />
      </TestParent>
    );

    packageConfig.forEach((pkg) => {
      expect(getByTestId(`package-type-${pkg.fileName}`).textContent).toBe(pkg.packageType);
      expect(getByTestId(`package-platform-${pkg.fileName}`).textContent).toBe(pkg.platform);

      const textDownload = getByTestId(`package-table-text-download-${pkg.fileName}`);
      expect(textDownload.textContent).toBe(pkg.fileName);
      expect(textDownload).toHaveAttribute("href", pkg.downloadURL);
      expect(textDownload).toHaveAttribute("download");
      expect(textDownload).toHaveAttribute("target", "_self");

      const iconDownload = getByTestId(`package-table-icon-download-${pkg.fileName}`);
      expect(iconDownload).toBeVisible();
      expect(iconDownload).toHaveAttribute("href", pkg.downloadURL);
      expect(iconDownload).toHaveAttribute("download");
      expect(iconDownload).toHaveAttribute("target", "_self");
    });
  });
});
