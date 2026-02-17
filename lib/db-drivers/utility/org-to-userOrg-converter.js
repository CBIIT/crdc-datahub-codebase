module.exports  = (organization) => {
    return {
        orgID: organization._id,
        orgName: organization.name,
        status: organization.status,
        createdAt: organization.createdAt,
        updateAt: organization.updateAt
    }
}
