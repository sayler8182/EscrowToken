const Abi = require('web3-eth-abi')

const indexedType = (type) => {
    const availableTypes = ['uint', 'int', 'byte', 'bool', 'address', '[]'];
    for (const availableType of availableTypes) {
        if (type.includes(availableType)) {
            return type;
        }
    }
    return "bytes32";
};

const decodeParameters = (names, types, data) => {
    const decoded = {};
    if (names.length && names.length === types.length) {
        const result = Abi.decodeParameters(types, data);
        for (let i = 0; i < types.length; i++) {
            decoded[names[i]] = result[i];
        }
    }
    return decoded;
}

const argsParser = (input) => {
    const indexedNames = [];
    const indexedTypes = [];
    const nonIndexedNames = [];
    const nonIndexedTypes = [];

    input.forEach(({ indexed, name, type }) => {
        if (indexed) {
            indexedNames.push(name);
            indexedTypes.push(indexedType(type));
        } else {
            nonIndexedNames.push(name);
            nonIndexedTypes.push(type);
        }
    });

    return ({ topics, data }) => {
        const indexedData = topics.slice(1).map(t => t.slice(2)).join('');
        const nonIndexedData = data.slice(2);
        return {
            ...decodeParameters(indexedNames, indexedTypes, indexedData),
            ...decodeParameters(nonIndexedNames, nonIndexedTypes, nonIndexedData),
        };
    };
}

const parseLogs = (logs, contractAbi) => {
    const _contractAbi = contractAbi.filter((i) => !i.anonymous);
    const events = _contractAbi.map(item => {
        return {
            name: item.name,
            signature: Abi.encodeEventSignature(`${item.name}(${item.inputs.map((i) => i.type).join(",")})`),
            args: argsParser(item.inputs),
        };
    });

    const result = events.reduce((values1, event) => {
        const value1 = logs.reduce((values2, log) => {
            if (log.topics[0] !== event.signature) { return values2; };
            const value2 = {
                name: event.name,
                address: log.address,
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                transactionHash: log.transactionHash,
                args: event.args(log),
                source: log,
            };
            values2.push(value2);
            return values2;
        }, []);
        values1.push(...value1);
        return values1;
    }, []);
    return result;
}

module.exports = {
    parseLogs,
};