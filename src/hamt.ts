const address = require('@glif/filecoin-address')

// Get n next bits
export function nextBits(obj, n) {
  // if (obj.left < n) throw new Error("out of bits")
  const res = (obj.num >> BigInt(obj.left - n)) & BigInt((1 << n) - 1)
  obj.left -= n
  return res
}

export function indexForBitPos(bp, bitfield) {
  let acc = bitfield
  let idx = 0
  while (bp > 0) {
    if ((acc & 1n) === 1n) {
      idx++
    }
    bp--
    acc = acc >> 1n
  }
  return idx
}

export function makeBuffers(obj) {
  if (typeof obj === 'string') {
    return Buffer.from(obj, 'base64')
  }
  if (obj instanceof Array) {
    return obj.map(makeBuffers)
  }
  return obj
}

async function forEach(n, load, cb) {
  let version = 2;
  if (!n.data.pointers[0]['/'] && (!Array.isArray(n.data.pointers[0]) || n.data.pointers[0]['0'].codec)) version = 1;
  if (version == 1) {
    for (const c of n.data.pointers) {
      if (c[0]) {
        const child = await load(c[0]['/'])
        await forEach({ bitWidth: n.bitWidth, data: parseNode(child) }, load, cb)
      }
      if (c[1]) {
        for (const [k, v] of c[1]) {
          await cb(Buffer.from(k, 'base64'), makeBuffers(v))
        }
      }
    }
  } else {
    for (const c of n.data.pointers) {
      if (c instanceof Array) {
        for (const [k, v] of c) {
          await cb(makeBuffers(k), makeBuffers(v))
        }
      } else {
        const child = await load(c['/'])
        await forEach({ bitWidth: n.bitWidth, data: parseNode(child) }, load, cb)
      }
    }
  }
}

export function bytesToBig(p) {
  let acc = 0n
  for (let i = 0; i < p.length; i++) {
    acc *= 256n
    acc += BigInt(p[i])
  }
  return acc
}


export function parseNode(data) {
  return {
    pointers: data[1],
    bitfield: bytesToBig(Buffer.from(data[0], 'base64')),
  }
}

export async function buildArrayData(data, load) {
  var dataArray = []
  await forEach({ bitWidth: 5, data: parseNode(data) }, load,
    (k, v) => {
      dataArray.push([address.encode('t', new address.Address(k)), bytesToBig(makeBuffers(v))])
    })

  return dataArray
}

export async function buildObject(data, load) {
  var dataObject = {};
  await forEach({ bitWidth: 5, data: parseNode(data) }, load,
    (k, v) => {
      dataObject[k.toString('hex')] = v;
    })
  return dataObject
}

export function readVarInt(bytes, offset = 0) {
  let res = 0n
  let acc = 1n
  for (let i = offset; i < bytes.length; i++) {
    res += BigInt(bytes[i] & 0x7f) * acc
    if (bytes[i] < 0x7f) {
      return res
    }
    acc *= 128n
  }
  return res
}

export async function asList(data, lookup) {
  const res = []
  await forEach({ bitWidth: 5, data: parseNode(data) }, lookup, async (k, v) => {
    //console.log(k,v);
    res.push([address.encode('t', new address.Address(k)), bytesToBig(makeBuffers(v))])
  })
  return res
}

export async function asListObject(data, lookup) {
  const res = {}
  await forEach({ bitWidth: 5, data: parseNode(data) }, lookup, async (k, v) => {
    const addressStr = address.encode('f', new address.Address(k));
    const allowance = bytesToBig(makeBuffers(v));
    res[addressStr] = {
      addressId: addressStr,
      allowance: allowance
    }
  })
  return res
}