function toLocalISO(utcTimestamp) {
    const date = new Date(utcTimestamp);
    const localIso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString();
    console.log(`Converted UTC ${utcTimestamp} to local ISO ${localIso}`);
    return localIso;
}

module.exports = { toLocalISO };