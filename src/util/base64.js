decode = (value) => {
    try {
        return atob(value);
    } catch (error) {
        console.error("Error decoding string: ", error);
        return null;
    }
}

export { decode };
export default decode;
