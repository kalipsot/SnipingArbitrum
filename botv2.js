import BigNumber from "bignumber.js";
import { checkHoneyPot, checkInternalFee,isVerified } from "./secu.js";
import { swap } from "./camellotSwap.js";
import Web3 from "web3";
import { readFileSync } from "fs";
const camelotRouterAbi = JSON.parse(readFileSync("./abi/camelotRouterAbi.json"));
const camelotFactoryAbi = JSON.parse(readFileSync("./abi/camelotFactoryAbi.json"));
const camelotPoolAbi = JSON.parse(readFileSync("./abi/camelotPoolAbi.json"));
const account = JSON.parse(readFileSync("./account.json"));
const config = JSON.parse(readFileSync("./config_bot.json"));

const web3 = new Web3(
	config.provider
);


const sleep = ms => new Promise(r => setTimeout(r, ms));

const factoryContract = new web3.eth.Contract(
	camelotFactoryAbi,
	"0x6EcCab422D763aC031210895C81787E87B43A652"
);

const routerContract = new web3.eth.Contract(
	camelotRouterAbi,
	"0xc873fEcbd354f5A56E00E710B90EF4201db2448d"
);


const bot = async (log) => {
	try {
		console.log("got data", log.topics);
		const token1 = "0x" + log.topics[1].substring(26);
		let token2 = "0x" + log.topics[2].substring(26);
		console.log(`normaly weth : ${token2}`);
		const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
		console.log(`== token 1 :  ${token1} token 2 : ${token2} ==`);
		let pairaddress = await factoryContract.methods.getPair(token1, token2).call();
		console.log(`== this is the address of the pair : ${pairaddress} ==`);
		let paircontract = new web3.eth.Contract(camelotPoolAbi, pairaddress);
		let reserve = await paircontract.methods.getReserves().call();
		let price = reserve._reserve0 / reserve._reserve1;
		console.log(`== curent price : ${price} ==`);
		let ammountIn = new BigNumber("5439190000000000");

		// security tests
		let honeypot; 
		let internalfees;
		let verified;
		if (token1 == WETH) {
			verified = await isVerified(token2);
			honeypot = await checkHoneyPot(web3,token2, ammountIn);
			internalfees = await checkInternalFee(web3,WETH, token2,ammountIn);
		} else {
			verified = await isVerified(token1);
			honeypot = await checkHoneyPot(web3,token1, ammountIn);
			internalfees = await checkInternalFee(web3,WETH, token1,ammountIn);
		}
		console.log(`sanity log fees: ${internalfees} -- honeypot : ${honeypot} -- verified : ${verified}`);
		if (WETH == token2) {
			console.log("== token 2 is weth ==");
			if ( internalfees && honeypot && verified && reserve._reserve1 >= config.sizeOfLiquidity ) {
				console.log("== token 2 is weth and all test passed ==");
				let amountOut = await swap(web3,ammountIn, [token2,token1] ,routerContract, account);
				await sleep(7200000);
				let finalAmountOut = await swap(web3,amountOut, [token1,token2] ,routerContract, account);
				console.log("== final amount out ==");
				console.log(finalAmountOut);
				console.log(`estimated profit : ${finalAmountOut - ammountIn}`);

			} else {
				console.log("== token 2 is weth but one test failed ==");
			}
		} else {
			console.log("== token 1 is weth ==");
			if ( internalfees && honeypot && verified && reserve._reserve0 >= config.sizeOfLiquidity ) {
				console.log("== token 1 is weth and all test passed ==");
				let amountOut = await swap(web3,ammountIn, [token1,token2] ,routerContract, account);
				await sleep(7200000);
				let finalAmountOut = await swap(web3,amountOut, [token2,token1] ,routerContract, account);
				console.log("== final amount out ==");
				console.log(finalAmountOut);
				console.log(`estimated profit : ${finalAmountOut - ammountIn}`);
			} else {
				console.log("== token 1 is weth but one test failed ==");
			}
		}

	} catch (error) {
		console.log(error);
	}
};


// main process for the bot

let options = {
	reconnect: {
		auto: true,
		delay: 5000, // ms
		maxAttempts: 120,
		onTimeout: false,
	},
	topics: [
		"0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9",
	],
	address: "0x6EcCab422D763aC031210895C81787E87B43A652",
};

let mintsubscription = web3.eth
	.subscribe("logs", options, function (error) {
		if (!error) console.log("got result");
		else console.log(error);
	})
	.on("data", async function (log) {
		await bot(log);
	})
	.on("changed", function () {
		console.log("changed");
	});






