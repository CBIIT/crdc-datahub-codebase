import yaml
import argparse
import os
 
ENV_SUFFIX = '_IMAGE'
 
# Env vars that end in _IMAGE but are NOT services and must never be
# written into the versions file.
IGNORED_ENV_VARS = {
    'RELEASE_IMAGE',
}
 
def getArgs():
    parser=argparse.ArgumentParser(description="versions file parser")
    parser.add_argument("file_name")
    args=parser.parse_args()
 
    return args.file_name
 
def readFile(file_name):
    with open(file_name, 'r') as file:
        data = yaml.safe_load(file)
    return data
 
def discoverServices():
    """Return {service_name: version} for every <SERVICE>_IMAGE env var
    the workflow exported with a non-empty value, e.g. FILEINTEGRITY_IMAGE
    -> {'fileintegrity': 'dev-crdcdh-3986.4'}."""
    services = {}
    for name, value in os.environ.items():
        if not name.endswith(ENV_SUFFIX) or name in IGNORED_ENV_VARS:
            continue
        if not value:
            continue
        svc = name[:-len(ENV_SUFFIX)].lower()
        services[svc] = value
    return services
 
def setVersions(parsed_file):
    services = parsed_file.setdefault('services', {})
    discovered = discoverServices()
 
    # Update services already in the file (keeps their existing order).
    for svc in services:
        envVarName = svc.upper() + ENV_SUFFIX
        new_version = os.environ.get(envVarName)
 
        if new_version is None:
            # Env var wasn't exported this run (e.g. commented out in the
            # workflow because this service isn't being deployed). Leave
            # its existing version untouched instead of crashing.
            print("Skipping '{}': {} not set, keeping existing version ({})".format(
                svc, envVarName, services[svc].get('version')))
            continue
 
        services[svc]['version'] = new_version
 
    # Append any service the workflow exported that the file doesn't know
    # about yet. This is what lets a versions file seeded from an older S3
    # copy pick up newly added services (e.g. fileintegrity).
    for svc, version in discovered.items():
        if svc not in services:
            print("Adding new service '{}' with version {}".format(svc, version))
            services[svc] = {'version': version}
 
    return parsed_file
 
def writeFile(file_name, data):
    # print("Data:  {}".format(data))
    with open(file_name, 'w') as file:
        yaml.dump(data, file, sort_keys=False)
 
if __name__ == "__main__":
   file_name = getArgs()
   parsed_file = readFile(file_name)
   data = setVersions(parsed_file)
   writeFile(file_name, data)
