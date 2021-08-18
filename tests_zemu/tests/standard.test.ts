/** ******************************************************************************
 *  (c) 2020 Zondax GmbH
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */

import Zemu, { DEFAULT_START_OPTIONS, DeviceModel } from '@zondax/zemu'
import InternetComputerApp from '@zondax/ledger-icp'
import * as secp256k1 from 'secp256k1'
import {SIGN_VALUES_P2} from "@zondax/ledger-icp/dist/common";

const sha256 = require('js-sha256')

const Resolve = require('path').resolve
const APP_PATH_S = Resolve('../app/output/app_s.elf')
const APP_PATH_X = Resolve('../app/output/app_x.elf')

const APP_SEED = 'equip will roof matter pink blind book anxiety banner elbow sun young'

const defaultOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
  X11: false,
}

jest.setTimeout(60000)

const models: DeviceModel[] = [
  { name: 'nanos', prefix: 'S', path: APP_PATH_S },
  { name: 'nanox', prefix: 'X', path: APP_PATH_X },
]

beforeAll(async () => {
  await Zemu.checkAndPullImage()
})

describe('Standard', function () {
  test.each(models)('can start and stop container', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
    } finally {
      await sim.close()
    }
  })

  test.each(models)('main menu', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      await sim.navigateAndCompareSnapshots('.', `${m.prefix.toLowerCase()}-mainmenu`, [1, 0, 0, 5, -5])
    } finally {
      await sim.close()
    }
  })

  test.each(models)('get app version', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())
      const resp = await app.getVersion()

      console.log(resp)

      expect(resp.returnCode).toEqual(0x9000)
      expect(resp.errorMessage).toEqual('No errors')
      expect(resp).toHaveProperty('testMode')
      expect(resp).toHaveProperty('major')
      expect(resp).toHaveProperty('minor')
      expect(resp).toHaveProperty('patch')
    } finally {
      await sim.close()
    }
  })

  test.each(models)('get address', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())

      const resp = await app.getAddressAndPubKey("m/44'/223'/0'/0/0")

      console.log(resp)

      expect(resp.returnCode).toEqual(0x9000)
      expect(resp.errorMessage).toEqual('No errors')

      const expected_principalTextual = '5upke-tazvi-6ufqc-i3v6r-j4gpu-dpwti-obhal-yb5xj-ue32x-ktkql-rqe'
      const expected_principal = '19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e302'
      const expected_pk =
        '0410d34980a51af89d3331ad5fa80fe30d8868ad87526460b3b3e15596ee58e812422987d8589ba61098264df5bb9c2d3ff6fe061746b4b31a44ec26636632b835'
      const expected_address = '4f3d4b40cdb852732601fccf8bd24dffe44957a647cb867913e982d98cf85676'

      expect(resp.principal.toString('hex')).toEqual(expected_principal)
      expect(resp.principalText).toEqual(expected_principalTextual)
      expect(resp.publicKey.toString('hex')).toEqual(expected_pk)
      expect(resp.address.toString('hex')).toEqual(expected_address)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('show address', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())

      const respRequest = app.showAddressAndPubKey("m/44'/223'/0'/0/0")

      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

      await sim.compareSnapshotsAndAccept('.', `${m.prefix.toLowerCase()}-show_address`, m.name === 'nanos' ? 4 : 5)

      const resp = await respRequest

      console.log(resp)

      expect(resp.returnCode).toEqual(0x9000)
      expect(resp.errorMessage).toEqual('No errors')

      const expected_principalTextual = '5upke-tazvi-6ufqc-i3v6r-j4gpu-dpwti-obhal-yb5xj-ue32x-ktkql-rqe'
      const expected_principal = '19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e302'
      const expected_pk =
        '0410d34980a51af89d3331ad5fa80fe30d8868ad87526460b3b3e15596ee58e812422987d8589ba61098264df5bb9c2d3ff6fe061746b4b31a44ec26636632b835'
      const expected_address = '4f3d4b40cdb852732601fccf8bd24dffe44957a647cb867913e982d98cf85676'

      expect(resp.principal.toString('hex')).toEqual(expected_principal)
      expect(resp.principalText).toEqual(expected_principalTextual)
      expect(resp.publicKey.toString('hex')).toEqual(expected_pk)
      expect(resp.address.toString('hex')).toEqual(expected_address)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign normal -- token transfer', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())

      const respAddr = await app.getAddressAndPubKey("m/44'/223'/0'/0/0")
      console.log(respAddr)

      expect(respAddr.returnCode).toEqual(0x9000)
      expect(respAddr.errorMessage).toEqual('No errors')

      const expected_pk =
        '0410d34980a51af89d3331ad5fa80fe30d8868ad87526460b3b3e15596ee58e812422987d8589ba61098264df5bb9c2d3ff6fe061746b4b31a44ec26636632b835'
      expect(respAddr.publicKey.toString('hex')).toEqual(expected_pk)

      const txBlobStr =
        'd9d9f7a367636f6e74656e74a76c726571756573745f747970656463616c6c656e6f6e636550f5390d960c6e52f489155a4309da03da6e696e67726573735f6578706972791b1674c5e29ec9c2106673656e646572581d19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e3026b63616e69737465725f69644a000000000000000201016b6d6574686f645f6e616d656773656e645f70626361726758560a0012050a0308e8071a0308890122220a2001010101010101010101010101010101010101010101010101010101010101012a220a2035548ec29e9d85305850e87a2d2642fe7214ff4bb36334070deafc3345c3b1276d73656e6465725f7075626b657958583056301006072a8648ce3d020106052b8104000a03420004e1142e1fbc940344d9161709196bb8bd151f94379c48dd507ab99a0776109128b94b5303cf2b2d28e25a779da175b62f8a975599b20c63d5193202640576ec5e6a73656e6465725f7369675840de5bccbb0a0173c432cd58ea4495d4d1e122d6ce04e31dcf63217f3d3a9b73130dc9bbf3b10e61c8db8bf8800bb4649e27786e5bc9418838c95864be28487a6a'

      const txBlob = Buffer.from(txBlobStr, 'hex')

      const respRequest = app.sign("m/44'/223'/0'/0/0", txBlob, SIGN_VALUES_P2.DEFAULT)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

      await sim.compareSnapshotsAndAccept('.', `${m.prefix.toLowerCase()}-sign_basic_normal`, m.name === 'nanos' ? 8 : 9)

      const signatureResponse = await respRequest
      console.log(signatureResponse)

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual('No errors')

      const expected_preHash = '0a69632d7265717565737438d75af52910efe58a5c32b61d3343ad1a40f32d335e88cab5843ec69d7bdf6a'
      expect(signatureResponse.preSignHash.toString('hex')).toEqual(expected_preHash)

      const expected_hash = '3797e39b76c78c7b33f724ba7b44b28721c6318a32e608ccee3940f3cba49de3'
      const hash = sha256.hex(signatureResponse.preSignHash)
      expect(hash).toEqual(expected_hash)

      const pk = Uint8Array.from(respAddr.publicKey)
      expect(pk.byteLength).toEqual(65)
      const digest = Uint8Array.from(Buffer.from(hash, 'hex'))
      const signature = Uint8Array.from(signatureResponse.signatureRS)
      //const signature = secp256k1.signatureImport(Uint8Array.from(signatureResponse.signatureDER));
      expect(signature.byteLength).toEqual(64)

      const signatureOk = secp256k1.ecdsaVerify(signature, digest, pk)
      expect(signatureOk).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign normal -- state transaction read', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())

      const respAddr = await app.getAddressAndPubKey("m/44'/223'/0'/0/0")
      console.log(respAddr)

      expect(respAddr.returnCode).toEqual(0x9000)
      expect(respAddr.errorMessage).toEqual('No errors')

      const expected_pk =
        '0410d34980a51af89d3331ad5fa80fe30d8868ad87526460b3b3e15596ee58e812422987d8589ba61098264df5bb9c2d3ff6fe061746b4b31a44ec26636632b835'
      expect(respAddr.publicKey.toString('hex')).toEqual(expected_pk)

      const txBlobStr =
        'd9d9f7a167636f6e74656e74a46e696e67726573735f6578706972791b16792e73143c0b0065706174687381824e726571756573745f7374617475735820a740262068c4b22efed0cc67095fc9ce46c883182c09aa045b4c0396060105d26c726571756573745f747970656a726561645f73746174656673656e646572581d19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e302'
      const txBlob = Buffer.from(txBlobStr, 'hex')

      const respRequest = app.sign("m/44'/223'/0'/0/0", txBlob, SIGN_VALUES_P2.DEFAULT)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

      await sim.compareSnapshotsAndAccept('.', `${m.prefix.toLowerCase()}-sign_stateread_normal`, m.name === 'nanos' ? 1 : 2)

      const signatureResponse = await respRequest
      console.log(signatureResponse)

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual('No errors')

      const expected_preHash = '0a69632d726571756573743223034c034fd8a23c5b4ea4e79af40a82cf43bd14c35740a8546b4fb5717a57'
      expect(signatureResponse.preSignHash.toString('hex')).toEqual(expected_preHash)

      const expected_hash = '0cb5a159215db7b9534d74dbfe97a495138c534520f4788f3518aa2c277966b0'
      const hash = sha256.hex(signatureResponse.preSignHash)
      expect(hash).toEqual(expected_hash)

      const pk = Uint8Array.from(respAddr.publicKey)
      expect(pk.byteLength).toEqual(65)
      const digest = Uint8Array.from(Buffer.from(hash, 'hex'))
      const signature = Uint8Array.from(signatureResponse.signatureRS)
      //const signature = secp256k1.signatureImport(Uint8Array.from(signatureResponse.signatureDER));
      expect(signature.byteLength).toEqual(64)

      const signatureOk = secp256k1.ecdsaVerify(signature, digest, pk)
      expect(signatureOk).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign expert -- token transfer', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())

      // Enable expert mode
      console.log('Set expert mode')
      await sim.clickRight()
      await sim.clickBoth()
      await sim.clickLeft()

      // Get public key
      const respAddr = await app.getAddressAndPubKey("m/44'/223'/0'/0/0")
      console.log(respAddr)
      expect(respAddr.returnCode).toEqual(0x9000)
      expect(respAddr.errorMessage).toEqual('No errors')
      const expected_pk =
        '0410d34980a51af89d3331ad5fa80fe30d8868ad87526460b3b3e15596ee58e812422987d8589ba61098264df5bb9c2d3ff6fe061746b4b31a44ec26636632b835'
      expect(respAddr.publicKey.toString('hex')).toEqual(expected_pk)

      // Sign blob
      const txBlobStr =
        'd9d9f7a367636f6e74656e74a76c726571756573745f747970656463616c6c656e6f6e636550f5390d960c6e52f489155a4309da03da6e696e67726573735f6578706972791b1674c5e29ec9c2106673656e646572581d19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e3026b63616e69737465725f69644a000000000000000201016b6d6574686f645f6e616d656773656e645f70626361726758560a0012050a0308e8071a0308890122220a2001010101010101010101010101010101010101010101010101010101010101012a220a2035548ec29e9d85305850e87a2d2642fe7214ff4bb36334070deafc3345c3b1276d73656e6465725f7075626b657958583056301006072a8648ce3d020106052b8104000a03420004e1142e1fbc940344d9161709196bb8bd151f94379c48dd507ab99a0776109128b94b5303cf2b2d28e25a779da175b62f8a975599b20c63d5193202640576ec5e6a73656e6465725f7369675840de5bccbb0a0173c432cd58ea4495d4d1e122d6ce04e31dcf63217f3d3a9b73130dc9bbf3b10e61c8db8bf8800bb4649e27786e5bc9418838c95864be28487a6a'
      const txBlob = Buffer.from(txBlobStr, 'hex')
      const respRequest = app.sign("m/44'/223'/0'/0/0", txBlob, SIGN_VALUES_P2.DEFAULT)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

      await sim.compareSnapshotsAndAccept('.', `${m.prefix.toLowerCase()}-sign_basic_expert`, m.name === 'nanos' ? 12 : 13)

      const signatureResponse = await respRequest
      console.log(signatureResponse)

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual('No errors')

      const expected_preHash = '0a69632d7265717565737438d75af52910efe58a5c32b61d3343ad1a40f32d335e88cab5843ec69d7bdf6a'
      expect(signatureResponse.preSignHash.toString('hex')).toEqual(expected_preHash)

      const expected_hash = '3797e39b76c78c7b33f724ba7b44b28721c6318a32e608ccee3940f3cba49de3'
      const hash = sha256.hex(signatureResponse.preSignHash)
      expect(hash).toEqual(expected_hash)

      const pk = Uint8Array.from(respAddr.publicKey)
      expect(pk.byteLength).toEqual(65)
      const digest = Uint8Array.from(Buffer.from(hash, 'hex'))
      const signature = Uint8Array.from(signatureResponse.signatureRS)
      //const signature = secp256k1.signatureImport(Uint8Array.from(signatureResponse.signatureDER));
      expect(signature.byteLength).toEqual(64)

      const signatureOk = secp256k1.ecdsaVerify(signature, digest, pk)
      expect(signatureOk).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign expert -- state transaction read', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())

      // Enable expert mode
      console.log('Set expert mode')
      await sim.clickRight()
      await sim.clickBoth()
      await sim.clickLeft()

      // get public key
      const respAddr = await app.getAddressAndPubKey("m/44'/223'/0'/0/0")
      console.log(respAddr)
      expect(respAddr.returnCode).toEqual(0x9000)
      expect(respAddr.errorMessage).toEqual('No errors')
      const expected_pk =
        '0410d34980a51af89d3331ad5fa80fe30d8868ad87526460b3b3e15596ee58e812422987d8589ba61098264df5bb9c2d3ff6fe061746b4b31a44ec26636632b835'
      expect(respAddr.publicKey.toString('hex')).toEqual(expected_pk)

      // Sign blob
      const txBlobStr =
        'd9d9f7a167636f6e74656e74a46e696e67726573735f6578706972791b16792e73143c0b0065706174687381824e726571756573745f7374617475735820a740262068c4b22efed0cc67095fc9ce46c883182c09aa045b4c0396060105d26c726571756573745f747970656a726561645f73746174656673656e646572581d19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e302'
      const txBlob = Buffer.from(txBlobStr, 'hex')

      const respRequest = app.sign("m/44'/223'/0'/0/0", txBlob, SIGN_VALUES_P2.DEFAULT)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

      await sim.compareSnapshotsAndAccept('.', `${m.prefix.toLowerCase()}-sign_stateread_expert`, m.name === 'nanos' ? 5 : 6)

      const signatureResponse = await respRequest
      console.log(signatureResponse)

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual('No errors')

      const expected_preHash = '0a69632d726571756573743223034c034fd8a23c5b4ea4e79af40a82cf43bd14c35740a8546b4fb5717a57'
      expect(signatureResponse.preSignHash.toString('hex')).toEqual(expected_preHash)

      const expected_hash = '0cb5a159215db7b9534d74dbfe97a495138c534520f4788f3518aa2c277966b0'
      const hash = sha256.hex(signatureResponse.preSignHash)
      expect(hash).toEqual(expected_hash)

      const pk = Uint8Array.from(respAddr.publicKey)
      expect(pk.byteLength).toEqual(65)
      const digest = Uint8Array.from(Buffer.from(hash, 'hex'))
      const signature = Uint8Array.from(signatureResponse.signatureRS)
      //const signature = secp256k1.signatureImport(Uint8Array.from(signatureResponse.signatureDER));
      expect(signature.byteLength).toEqual(64)

      const signatureOk = secp256k1.ecdsaVerify(signature, digest, pk)
      expect(signatureOk).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign normal -- Increase Neuron Timer', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())

      const pkhex =
          '0410d34980a51af89d3331ad5fa80fe30d8868ad87526460b3b3e15596ee58e812422987d8589ba61098264df5bb9c2d3ff6fe061746b4b31a44ec26636632b835'

      const txBlobStr =
          'd9d9f7a367636f6e74656e74a76c726571756573745f747970656463616c6c656e6f6e636550732123f52b79b4a4de9b89e0cc3de7586e696e67726573735f6578706972791b1674db8a3bb843006673656e646572581d19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e3026b63616e69737465725f69644a000000000000000101016b6d6574686f645f6e616d65706d616e6167655f6e6575726f6e5f7062636172674c0a02107b12060a040880a3056d73656e6465725f7075626b657958583056301006072a8648ce3d020106052b8104000a03420004e1142e1fbc940344d9161709196bb8bd151f94379c48dd507ab99a0776109128b94b5303cf2b2d28e25a779da175b62f8a975599b20c63d5193202640576ec5e6a73656e6465725f7369675840953620923534b8840d057341bfaf4511dfa73f57372e7946aed83bfde737e44c5c3005b6f19d4342b9e46c78b2c6fa4f67cf203d6a7cab51a84aa486b459536b'
      const txBlob = Buffer.from(txBlobStr, 'hex')

      const respRequest = app.sign("m/44'/223'/0'/0/0", txBlob, SIGN_VALUES_P2.DEFAULT)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

      await sim.compareSnapshotsAndAccept('.', `${m.prefix.toLowerCase()}-sign_increaseTimer_normal`, m.name === 'nanos' ? 3 : 4)

      const signatureResponse = await respRequest
      console.log(signatureResponse)

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual('No errors')

      const hash = sha256.hex(signatureResponse.preSignHash)

      const pk = Uint8Array.from(Buffer.from(pkhex, 'hex'))
      expect(pk.byteLength).toEqual(65)
      const digest = Uint8Array.from(Buffer.from(hash, 'hex'))
      const signature = Uint8Array.from(signatureResponse.signatureRS)
      //const signature = secp256k1.signatureImport(Uint8Array.from(signatureResponse.signatureDER));
      expect(signature.byteLength).toEqual(64)

      const signatureOk = secp256k1.ecdsaVerify(signature, digest, pk)
      expect(signatureOk).toEqual(true)
    } finally {
      await sim.close()
    }
  })

  test.each(models)('sign normal -- stake transfer', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())

      const expected_pk =
          '0410d34980a51af89d3331ad5fa80fe30d8868ad87526460b3b3e15596ee58e812422987d8589ba61098264df5bb9c2d3ff6fe061746b4b31a44ec26636632b835'

      const txBlobStr =
          'd9d9f7a167636f6e74656e74a663617267583e0a0a08f2d4a0eca697869f0812070a050880c2d72f1a0308904e2a220a20a8a1abecdb66f57eb6eba44c3b5f11a6c433fe932680a9519b064b80ca8794e16b63616e69737465725f69644a000000000000000201016e696e67726573735f6578706972791b16985a582755f1806b6d6574686f645f6e616d656773656e645f70626c726571756573745f747970656463616c6c6673656e646572581d19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e302'

      const txBlob = Buffer.from(txBlobStr, 'hex')

      const respRequest = app.sign("m/44'/223'/0'/0/0", txBlob, SIGN_VALUES_P2.STAKE_TX)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

      await sim.compareSnapshotsAndAccept('.', `${m.prefix.toLowerCase()}-sign_staketx_normal`, m.name === 'nanos' ? 8 : 9)

      const signatureResponse = await respRequest
      console.log(signatureResponse)

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual('No errors')

      const hash = sha256.hex(signatureResponse.preSignHash)

      const pk = Uint8Array.from(Buffer.from(expected_pk, 'hex'))
      const digest = Uint8Array.from(Buffer.from(hash, 'hex'))
      const signature = Uint8Array.from(signatureResponse.signatureRS)
      expect(signature.byteLength).toEqual(64)

      const signatureOk = secp256k1.ecdsaVerify(signature, digest, pk)
      expect(signatureOk).toEqual(true)
    } finally {
      await sim.close()
    }
  })
  test.each(models)('sign normal -- add hotkey', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new InternetComputerApp(sim.getTransport())

      const txBlobStr =
          'd9d9f7a167636f6e74656e74a6636172675832620b10b98488e0c7a8cec9bd01122322210a1f0a1d19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e3026b63616e69737465725f69644a000000000000000101016e696e67726573735f6578706972791b1698b4cd1475e3c06b6d6574686f645f6e616d65706d616e6167655f6e6575726f6e5f70626c726571756573745f747970656463616c6c6673656e646572581d19aa3d42c048dd7d14f0cfa0df69a1c1381780f6e9a137abaa6a82e302'

      const txBlob = Buffer.from(txBlobStr, 'hex')

      const respRequest = app.sign("m/44'/223'/0'/0/0", txBlob, SIGN_VALUES_P2.DEFAULT)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())

      await sim.compareSnapshotsAndAccept('.', `${m.prefix.toLowerCase()}-sign_addHotkey`, m.name === 'nanos' ? 3 : 4)

      const signatureResponse = await respRequest
      console.log(signatureResponse)

      expect(signatureResponse.returnCode).toEqual(0x9000)
      expect(signatureResponse.errorMessage).toEqual('No errors')

    } finally {
      await sim.close()
    }
  })
})
