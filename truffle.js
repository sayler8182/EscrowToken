module.exports = {
    compilers: {
        solc: {
            version: "^0.5.2",
        },
    },
    networks: {
        ganache: {
            mnemonic: "nephew apology bacon pelican country escape emerge prepare leave easily wrist wealth",
            host: "localhost",
            port: 7545,
            network_id: "*",
        },
    },
};
