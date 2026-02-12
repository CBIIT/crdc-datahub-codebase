import env from "../env";

export type PackageConfig = {
  packageType: string;
  platform: string;
  fileName: string;
  downloadURL: string;
};

const packageConfig: PackageConfig[] = [
  {
    packageType: "Source",
    platform: "Any",
    fileName: env?.VITE_UPLOADER_CLI?.split("/")?.pop() || "",
    downloadURL: env?.VITE_UPLOADER_CLI,
  },
  {
    packageType: "Binary",
    platform: "Windows x64",
    fileName: env?.VITE_UPLOADER_CLI_WINDOWS?.split("/")?.pop() || "",
    downloadURL: env?.VITE_UPLOADER_CLI_WINDOWS,
  },
  {
    packageType: "Binary",
    platform: "MacOS x64",
    fileName: env?.VITE_UPLOADER_CLI_MAC_X64?.split("/")?.pop() || "",
    downloadURL: env?.VITE_UPLOADER_CLI_MAC_X64,
  },
  {
    packageType: "Binary",
    platform: "MacOS ARM",
    fileName: env?.VITE_UPLOADER_CLI_MAC_ARM?.split("/")?.pop() || "",
    downloadURL: env?.VITE_UPLOADER_CLI_MAC_ARM,
  },
];

export default packageConfig;
