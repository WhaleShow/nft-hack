import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Switch, Route, Link } from "react-router-dom";
import "antd/dist/antd.css";
import { JsonRpcProvider, Web3Provider } from "@ethersproject/providers";
import { SendOutlined, CaretUpOutlined, HistoryOutlined } from "@ant-design/icons";
import "./App.css";
import { Select, Row, Col, Button, Menu, Alert, Spin, List, Card, Switch as SwitchD } from "antd";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { useUserAddress } from "eth-hooks";
import { usePoller, useExchangePrice, useGasPrice, useUserProvider, useContractLoader, useContractReader, useEventListener, useBalance, useExternalContractLoader } from "./hooks";
import { Header, Account, Faucet, Ramp, Contract, GasGauge, Address, AddressInput, EtherInput, Balance, ThemeSwitch, QRPunkBlockie } from "./components";
import { Transactor } from "./helpers";
import { formatEther, parseEther } from "@ethersproject/units";
import { utils } from "ethers";
//import Hints from "./Hints";
import { Hints, ExampleUI, Subgraph } from "./views"
import { useThemeSwitcher } from "react-css-theme-switcher";
import { INFURA_ID, DAI_ADDRESS, DAI_ABI, NETWORK, NETWORKS } from "./constants";
import StackGrid from "react-stack-grid";
import ReactJson from 'react-json-view'
import assets from './assets.js'
const { ethers } = require("ethers");

const { BufferList } = require('bl')
// https://www.npmjs.com/package/ipfs-http-client
const ipfsAPI = require('ipfs-http-client');
const ipfs = ipfsAPI({ host: 'ipfs.infura.io', port: '5001', protocol: 'https' })

console.log("📦 Assets: ", assets)

/*
    Welcome to 🏗 scaffold-eth !

    Code:
    https://github.com/austintgriffith/scaffold-eth

    Support:
    https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA
    or DM @austingriffith on twitter or telegram

    You should get your own Infura.io ID and put it in `constants.js`
    (this is your connection to the main Ethereum network for ENS etc.)


    🌏 EXTERNAL CONTRACTS:
    You can also bring in contract artifacts in `constants.js`
    (and then use the `useExternalContractLoader()` hook!)
*/


/// 📡 What chain are your contracts deployed to?
const cachedNetwork = window.localStorage.getItem("network")
const targetNetwork = NETWORKS['localhost']; // <------- select your target frontend network (localhost, rinkeby, xdai, mainnet)
if (!targetNetwork) {
  targetNetwork = NETWORKS['localhost'];
}

// 😬 Sorry for all the console logging
const DEBUG = true

//helper function to "Get" from IPFS
// you usually go content.toString() after this...
const getFromIPFS = async hashToGet => {
  for await (const file of ipfs.get(hashToGet)) {
    console.log(file.path)
    if (!file.content) continue;
    const content = new BufferList()
    for await (const chunk of file.content) {
      content.append(chunk)
    }
    console.log(content)
    return content
  }
}

// 🛰 providers
if (DEBUG) console.log("📡 Connecting to Mainnet Ethereum");
// const mainnetProvider = getDefaultProvider("mainnet", { infura: INFURA_ID, etherscan: ETHERSCAN_KEY, quorum: 1 });
// const mainnetProvider = new InfuraProvider("mainnet",INFURA_ID);
//
// attempt to connect to our own scaffold eth rpc and if that fails fall back to infura...
const scaffoldEthProvider = new JsonRpcProvider("https://rpc.scaffoldeth.io:48544")
const mainnetInfura = new JsonRpcProvider("https://mainnet.infura.io/v3/" + INFURA_ID)
// ( ⚠️ Getting "failed to meet quorum" errors? Check your INFURA_I

// 🏠 Your local provider is usually pointed at your local blockchain
const localProviderUrl = targetNetwork.rpcUrl;
// as you deploy to other networks you can set REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
const localProviderUrlFromEnv = process.env.REACT_APP_PROVIDER ? process.env.REACT_APP_PROVIDER : localProviderUrl;
if (DEBUG) console.log("🏠 Connecting to provider:", localProviderUrlFromEnv);
const localProvider = new JsonRpcProvider(localProviderUrlFromEnv);


// 🔭 block explorer URL
const blockExplorer = targetNetwork.blockExplorer;

// a function to check your balance on every network and switch networks if found...
const checkBalances = async (address) => {
  for (let n in NETWORKS) {
    let tempProvider = new JsonRpcProvider(NETWORKS[n].rpcUrl);
    let tempBalance = await tempProvider.getBalance(address);
    let result = tempBalance && formatEther(tempBalance)
    if (result != 0) {
      console.log("Found a balance in ", n)
      window.localStorage.setItem("network", n);
      setTimeout(() => {
        window.location.reload();
      }, 1);
    }
  }
}

function App(props) {

  const mainnetProvider = (scaffoldEthProvider && scaffoldEthProvider._network) ? scaffoldEthProvider : mainnetInfura
  if (DEBUG) console.log("🌎 mainnetProvider", mainnetProvider)

  const [injectedProvider, setInjectedProvider] = useState();
  /* 💵 This hook will get the price of ETH from 🦄 Uniswap: */
  const price = useExchangePrice(targetNetwork, mainnetProvider);

  /* 🔥 This hook will get the price of Gas from ⛽️ EtherGasStation */
  const gasPrice = useGasPrice(targetNetwork, "fast");
  // Use your injected provider from 🦊 Metamask or if you don't have it then instantly generate a 🔥 burner wallet.
  const userProvider = useUserProvider(injectedProvider, localProvider);
  const address = useUserAddress(userProvider);
  if (DEBUG) console.log("👩‍💼 selected address:", address)

  // You can warn the user if you would like them to be on a specific network
  let localChainId = localProvider && localProvider._network && localProvider._network.chainId
  if (DEBUG) console.log("🏠 localChainId", localChainId)

  let selectedChainId = userProvider && userProvider._network && userProvider._network.chainId
  if (DEBUG) console.log("🕵🏻‍♂️ selectedChainId:", selectedChainId)

  // For more hooks, check out 🔗eth-hooks at: https://www.npmjs.com/package/eth-hooks

  // The transactor wraps transactions and provides notificiations
  const tx = Transactor(userProvider, gasPrice)

  // Faucet Tx can be used to send funds from the faucet
  const faucetTx = Transactor(localProvider, gasPrice)

  // 🏗 scaffold-eth is full of handy hooks like this one to get your balance:
  const yourLocalBalance = useBalance(localProvider, address);
  if (DEBUG) console.log("💵 yourLocalBalance", yourLocalBalance ? formatEther(yourLocalBalance) : "...")

  const mainBalance = yourLocalBalance && formatEther(yourLocalBalance)

  //if you don't have any money, scan the other networks for money
  usePoller(() => {
    if (!cachedNetwork) {
      if (mainBalance == 0) {
        checkBalances(address)
      }
    }
  }, 7777)
  setTimeout(() => {
    if (!cachedNetwork) {
      if (balance == 0) {
        checkBalances(address)
      }
    }
  }, 1777)
  setTimeout(() => {
    if (!cachedNetwork) {
      if (balance == 0) {
        checkBalances(address)
      }
    }
  }, 3777)

  // Just plug in different 🛰 providers to get your balance on different chains:
  const yourMainnetBalance = useBalance(mainnetProvider, address);
  if (DEBUG) console.log("💵 yourMainnetBalance", yourMainnetBalance ? formatEther(yourMainnetBalance) : "...")

  // Load in your local 📝 contract and read a value from it:
  const readContracts = useContractLoader(localProvider)
  if (DEBUG) console.log("📝 readContracts", readContracts)

  // If you want to make 🔐 write transactions to your contracts, use the userProvider:
  const writeContracts = useContractLoader(userProvider)
  if (DEBUG) console.log("🔐 writeContracts", writeContracts)

  // // EXTERNAL CONTRACT EXAMPLE:
  // //
  // // If you want to bring in the mainnet DAI contract it would look like:
  // const mainnetDAIContract = useExternalContractLoader(mainnetProvider, DAI_ADDRESS, DAI_ABI)
  // console.log("🌍 DAI contract on mainnet:", mainnetDAIContract)
  // //
  // // Then read your DAI balance like:
  // const myMainnetDAIBalance = useContractReader({ DAI: mainnetDAIContract }, "DAI", "balanceOf", ["0x34aA3F359A9D614239015126635CE7732c18fDF3"])
  // console.log("🥇 myMainnetDAIBalance:", myMainnetDAIBalance)


  // keep track of a variable from the contract in the local React state:
  const balance = useContractReader(readContracts, "WhaleShow", "balanceOf", [address])
  console.log("🤗 balance:", balance)

  //📟 Listen for broadcast events
  const transferEvents = useEventListener(readContracts, "WhaleShow", "Transfer", localProvider, 1);
  console.log("📟 Transfer events:", transferEvents)



  //
  // 🧠 This effect will update whaleShows by polling when your balance changes
  //
  const yourBalance = balance && balance.toNumber && balance.toNumber()
  const [whaleShows, setWhaleShows] = useState()

  useEffect(() => {
    const updateWhaleShows = async () => {
      let collectibleUpdate = []
      for (let tokenIndex = 0; tokenIndex < balance; tokenIndex++) {
        try {
          console.log("GEtting token index", tokenIndex)
          const tokenId = await readContracts.WhaleShow.tokenOfOwnerByIndex(address, tokenIndex)
          console.log("tokenId", tokenId)
          const tokenURI = await readContracts.WhaleShow.tokenURI(tokenId)
          console.log("tokenURI", tokenURI)

          const ipfsHash = tokenURI.replace("https://ipfs.io/ipfs/", "")
          console.log("ipfsHash", ipfsHash)

          const jsonManifestBuffer = await getFromIPFS(ipfsHash)

          try {
            const jsonManifest = JSON.parse(jsonManifestBuffer.toString())
            console.log("jsonManifest", jsonManifest)
            collectibleUpdate.push({ id: tokenId, uri: tokenURI, owner: address, ...jsonManifest })
          } catch (e) { console.log(e) }

        } catch (e) { console.log(e) }
      }
      setWhaleShows(collectibleUpdate)
    }
    updateWhaleShows()
  }, [address, yourBalance])

  /*
  const addressFromENS = useResolveName(mainnetProvider, "austingriffith.eth");
  console.log("🏷 Resolved austingriffith.eth as:",addressFromENS)
  */


  let networkDisplay = ""
  if (localChainId && selectedChainId && localChainId != selectedChainId) {
    networkDisplay = (
      <div style={{ zIndex: 2, position: 'absolute', right: 0, top: 0, padding: 18 }}>
        <Alert
          message={"⚠️ Wrong Network"}
          description={(
            <div>
              You have <b>{NETWORK(selectedChainId).name}</b> selected and you need to be on <Button onClick={async () => {
                let ethereum = window.ethereum;
                const data = [{
                  chainId: "0x" + targetNetwork.chainId.toString(16),
                  chainName: targetNetwork.name,
                  nativeCurrency: targetNetwork.nativeCurrency,
                  rpcUrls: [targetNetwork.rpcUrl],
                  blockExplorerUrls: [targetNetwork.blockExplorer],
                }]
                console.log("data", data)
                const tx = await ethereum.request({ method: 'wallet_addEthereumChain', params: data }).catch()
                if (tx) {
                  console.log(tx)
                }
              }}>{NETWORK(localChainId).name}</Button>.
            </div>
          )}
          type="error"
          closable={false}
        />
      </div>
    )
  }

  let options = []
  for (let id in NETWORKS) {
    options.push(
      <Select.Option key={id} value={NETWORKS[id].name}><span style={{ color: NETWORKS[id].color }}>
        {NETWORKS[id].name}
      </span></Select.Option>
    )
  }

  const networkSelect = (
    <Select defaultValue={targetNetwork.name} style={{ textAlign: "left", width: 120 }} onChange={(value) => {
      if (targetNetwork.chainId != NETWORKS[value].chainId) {
        window.localStorage.setItem("network", value);
        setTimeout(() => {
          window.location.reload();
        }, 1);
      }
    }}>
      {options}
    </Select>
  )

  const loadWeb3Modal = useCallback(async () => {
    const provider = await web3Modal.connect();
    setInjectedProvider(new Web3Provider(provider));
  }, [setInjectedProvider]);

  useEffect(() => {
    if (web3Modal.cachedProvider) {
      loadWeb3Modal();
    }
  }, [loadWeb3Modal]);

  const [route, setRoute] = useState();
  useEffect(() => {
    setRoute(window.location.pathname)
  }, [setRoute]);

  let faucetHint = ""
  const faucetAvailable = localProvider && localProvider.connection && localProvider.connection.url && localProvider.connection.url.indexOf("localhost") >= 0 && !process.env.REACT_APP_PROVIDER && price > 1;

  const [faucetClicked, setFaucetClicked] = useState(false);
  if (!faucetClicked && localProvider && localProvider._network && localProvider._network.chainId == 31337 && yourLocalBalance && formatEther(yourLocalBalance) <= 0) {
    faucetHint = (
      <div style={{ padding: 16 }}>
        <Button type={"primary"} onClick={() => {
          faucetTx({
            to: address,
            value: parseEther("0.01"),
          });
          setFaucetClicked(true)
        }}>
          💰 Grab funds from the faucet ⛽️
        </Button>
      </div>
    )
  }

  let startingAddress = ""
  if (window.location.pathname) {
    let incoming = window.location.pathname.replace("/", "")
    if (incoming && ethers.utils.isAddress(incoming)) {
      startingAddress = incoming
      window.history.pushState({}, "", "/");
    }

    /*let rawPK
    if(incomingPK.length===64||incomingPK.length===66){
      console.log("🔑 Incoming Private Key...");
      rawPK=incomingPK
      burnerConfig.privateKey = rawPK
      window.history.pushState({},"", "/");
      let currentPrivateKey = window.localStorage.getItem("metaPrivateKey");
      if(currentPrivateKey && currentPrivateKey!==rawPK){
        window.localStorage.setItem("metaPrivateKey_backup"+Date.now(),currentPrivateKey);
      }
      window.localStorage.setItem("metaPrivateKey",rawPK);
    }*/
  }
  //console.log("startingAddress",startingAddress)
  const [amount, setAmount] = useState();
  const [toAddress, setToAddress] = useState(startingAddress);

  const [loading, setLoading] = useState(false);

  const [transferToAddresses, setTransferToAddresses] = useState({})

  const [loadedAssets, setLoadedAssets] = useState()
  useEffect(() => {
    const updateWhaleShows = async () => {
      let assetUpdate = []
      for (let a in assets) {
        try {
          const forSale = await readContracts.WhaleShow.forSale(utils.id(a))
          let owner
          if (!forSale) {
            const tokenId = await readContracts.WhaleShow.uriToTokenId(utils.id(a))
            owner = await readContracts.WhaleShow.ownerOf(tokenId)
          }
          assetUpdate.push({ id: a, ...assets[a], forSale: forSale, owner: owner })
        } catch (e) { console.log(e) }
      }
      setLoadedAssets(assetUpdate)
    }
    if (readContracts && readContracts.WhaleShow) updateWhaleShows()
  }, [assets, readContracts, transferEvents]);

  let showList = []
  for (let a in loadedAssets) {
    console.log("loadedAssets", a, loadedAssets[a])

    let cardActions = []
    if (loadedAssets[a].forSale) {
      cardActions.push(
        <div>
          <Button onClick={() => {
            console.log("gasPrice,", gasPrice)
            tx(writeContracts.WhaleShow.mintItem(loadedAssets[a].id, { gasPrice: gasPrice }))
          }}>
            Mint
          </Button>
        </div>
      )
    } else {
      cardActions.push(
        <div>
          owned by: <Address
            address={loadedAssets[a].owner}
            ensProvider={mainnetProvider}
            blockExplorer={blockExplorer}
            minimized={true}
          />
        </div>
      )
    }

    showList.push(
      <Card style={{ width: 200 }} key={loadedAssets[a].name}
        actions={cardActions}
        title={(
          <div>
            {loadedAssets[a].name} <a style={{ cursor: "pointer", opacity: 0.33 }} href={loadedAssets[a].external_url} target="_blank"></a>
          </div>
        )}
      >
        <img style={{ maxWidth: 130 }} src={loadedAssets[a].image} />
        <div style={{ opacity: 0.77 }}>
          {loadedAssets[a].description}
        </div>
      </Card>
    )
  }
  return (
    <div className="App">
      {networkDisplay}
      <div style={{ float: "left" }}>
        <Header />
      </div>
      <div style={{ float: "right", padding: 16 }}>
        {address ? (
          <div>
            <Address address={address} ensProvider={mainnetProvider} blockExplorer={blockExplorer} />
            <Button
              key="history"
              type="text"
              onClick={async () => {
                window.open("https://zapper.fi/transactions?address=" + address)
              }}
            ><HistoryOutlined /></Button>
          </div>
        ) : <Spin />}
      </div>

      <div style={{ clear: "both", opacity: yourLocalBalance ? 1 : 0.2, width: 360, margin: "auto" }}>
        <Balance value={yourLocalBalance} size={36} price={price} /><span style={{ verticalAlign: "middle" }}>{networkSelect}</span>
      </div>

      <div style={{ padding: 16, cursor: "pointer", backgroundColor: "#FFFFFF", width: 420, margin: "auto" }}>
        <QRPunkBlockie withQr={true} address={address} />
      </div>

      <div style={{ position: "relative", width: 320, margin: "auto", textAlign: "center", marginTop: 32 }}>
        <div style={{ padding: 10 }}>
          <AddressInput
            ensProvider={mainnetProvider}
            placeholder="to address"
            address={toAddress}
            onChange={setToAddress}
          />
        </div>
        <div style={{ padding: 10 }}>
          <EtherInput
            price={price ? price : targetNetwork.price}
            value={amount}
            onChange={value => {
              setAmount(value);
            }}
          />
        </div>
        <div style={{ padding: 10 }}>
          <Button
            key="submit"
            type="primary"
            disabled={loading || !amount || !toAddress}
            loading={loading}
            onClick={async () => {
              setLoading(true)

              let value;
              try {
                value = parseEther("" + amount);
              } catch (e) {
                let floatVal = parseFloat(amount).toFixed(8)
                // failed to parseEther, try something else
                value = parseEther("" + floatVal);
              }

              let result = tx({
                to: toAddress,
                value,
                gasPrice: gasPrice,
                gasLimit: 21000
              });
              //setToAddress("")
              setAmount("")
              result = await result
              console.log(result)
              setLoading(false)
            }}
          >
            {loading || !amount || !toAddress ? <CaretUpOutlined /> : <SendOutlined style={{ color: "#FFFFFF" }} />} Send
          </Button>
        </div>

      </div>
      <BrowserRouter>

        <Menu style={{ textAlign: "center" }} selectedKeys={[route]} mode="horizontal">
          <Menu.Item key="/">
            <Link onClick={() => { setRoute("/") }} to="/">Shows</Link>
          </Menu.Item>
          <Menu.Item key="/owned">
            <Link onClick={() => { setRoute("/owned") }} to="/owned">Owned</Link>
          </Menu.Item>
          <Menu.Item key="/transfers">
            <Link onClick={() => { setRoute("/transfers") }} to="/transfers">Transfers</Link>
          </Menu.Item>
          <Menu.Item key="/debugcontracts">
            <Link onClick={() => { setRoute("/debugcontracts") }} to="/debugcontracts">Debug Contracts</Link>
          </Menu.Item>
        </Menu>

        <Switch>
          <Route exact path="/">

            <div style={{ maxWidth: 820, margin: "auto", marginTop: 32, paddingBottom: 256 }}>
              <StackGrid
                columnWidth={200}
                gutterWidth={16}
                gutterHeight={16}
              >
                {showList}
              </StackGrid>
            </div>

          </Route>

          <Route path="/owned">
            <div style={{ width: 640, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <List
                bordered
                dataSource={whaleShows}
                renderItem={(item) => {
                  const id = item.id.toNumber()
                  return (
                    <List.Item key={id + "_" + item.uri + "_" + item.owner}>
                      <Card title={(
                        <div>
                          <span style={{ fontSize: 16, marginRight: 8 }}>#{id}</span> {item.name}
                        </div>
                      )}>
                        <div><img src={item.image} style={{ maxWidth: 150 }} /></div>
                        <div>{item.description}</div>
                      </Card>

                      <div>
                        owner: <Address
                          address={item.owner}
                          ensProvider={mainnetProvider}
                          blockExplorer={blockExplorer}
                          fontSize={16}
                        />
                        <AddressInput
                          ensProvider={mainnetProvider}
                          placeholder="transfer to address"
                          value={transferToAddresses[id]}
                          onChange={(newValue) => {
                            let update = {}
                            update[id] = newValue
                            setTransferToAddresses({ ...transferToAddresses, ...update })
                          }}
                        />
                        <Button onClick={() => {
                          console.log("writeContracts", writeContracts)
                          tx(writeContracts.WhaleShow.transferFrom(address, transferToAddresses[id], id))
                        }}>
                          Transfer
                        </Button>
                      </div>
                    </List.Item>
                  )
                }}
              />
            </div>
          </Route>

          <Route path="/transfers">
            <div style={{ width: 600, margin: "auto", marginTop: 32, paddingBottom: 32 }}>
              <List
                bordered
                dataSource={transferEvents}
                renderItem={(item) => {
                  return (
                    <List.Item key={item[0] + "_" + item[1] + "_" + item.blockNumber + "_" + item[2].toNumber()}>
                      <span style={{ fontSize: 16, marginRight: 8 }}>#{item[2].toNumber()}</span>
                      <Address
                        address={item[0]}
                        ensProvider={mainnetProvider}
                        fontSize={16}
                      /> =>
                      <Address
                        address={item[1]}
                        ensProvider={mainnetProvider}
                        fontSize={16}
                      />
                    </List.Item>
                  )
                }}
              />
            </div>
          </Route>

          <Route path="/debugcontracts">
            <Contract
              name="WhaleShow"
              signer={userProvider.getSigner()}
              provider={localProvider}
              address={address}
              blockExplorer={blockExplorer}
            />
          </Route>
        </Switch>
      </BrowserRouter>

      {/* <ThemeSwitch /> */}

      <div style={{ zIndex: -1, padding: 64, opacity: 0.5, fontSize: 12 }}>
        created with <span style={{ marginRight: 4 }}>🏗</span><a href="https://github.com/austintgriffith/scaffold-eth#-scaffold-eth" target="_blank">scaffold-eth</a>
      </div>
      <div style={{ padding: 32 }}>
      </div>

      {/* 👨‍💼 Your account is in the top right with a wallet at connect options */}
      <div style={{ position: "fixed", textAlign: "right", right: 0, bottom: 16, padding: 10 }}>
        <Account
          address={address}
          localProvider={localProvider}
          userProvider={userProvider}
          mainnetProvider={mainnetProvider}
          price={price}
          web3Modal={web3Modal}
          loadWeb3Modal={loadWeb3Modal}
          logoutOfWeb3Modal={logoutOfWeb3Modal}
          blockExplorer={blockExplorer}
        />
        {faucetHint}
        {networkDisplay}
      </div>

      {/* 🗺 Extra UI like gas price, eth price, faucet, and support: */}
      <div style={{ position: "fixed", textAlign: "left", left: 0, bottom: 20, padding: 10 }}>
        <Row align="middle" gutter={[4, 4]}>
          <Col span={8}>
            <Ramp price={price} address={address} networks={NETWORKS} />
          </Col>

          <Col span={8} style={{ textAlign: "center", opacity: 0.8 }}>
            <GasGauge gasPrice={gasPrice} />
          </Col>
          <Col span={8} style={{ textAlign: "center", opacity: 1 }}>
            <Button
              onClick={() => {
                window.open("https://t.me/joinchat/KByvmRe5wkR-8F_zz6AjpA");
              }}
              size="large"
              shape="round"
            >
              <span style={{ marginRight: 8 }} role="img" aria-label="support">
                💬
               </span>
               Support
             </Button>
          </Col>
        </Row>

        <Row align="middle" gutter={[4, 4]}>
          <Col span={24}>
            {
              /*  if the local provider has a signer, let's show the faucet:  */
              faucetAvailable ? (
                <Faucet localProvider={localProvider} price={price} ensProvider={mainnetProvider} />
              ) : (
                  ""
                )
            }
          </Col>
        </Row>
      </div>

    </div>
  );
}


/*
  Web3 modal helps us "connect" external wallets:
*/
const web3Modal = new Web3Modal({
  // network: "mainnet", // optional
  cacheProvider: true, // optional
  providerOptions: {
    walletconnect: {
      package: WalletConnectProvider, // required
      options: {
        infuraId: INFURA_ID,
      },
    },
  },
});

const logoutOfWeb3Modal = async () => {
  await web3Modal.clearCachedProvider();
  setTimeout(() => {
    window.location.reload();
  }, 1);
};

window.ethereum && window.ethereum.on('chainChanged', chainId => {
  setTimeout(() => {
    window.location.reload();
  }, 1);
})

export default App;
