function isCaseInsensitiveEqual(source, target) {
    if (!target || !source) return false;
    if (source.toLowerCase() === target.toLowerCase()) return true;
}

module.exports = {
    isCaseInsensitiveEqual
}