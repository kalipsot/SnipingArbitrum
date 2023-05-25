// func for security check
import fetch from  "node-fetch" ;
import { readFileSync } from "fs";
const camelotRouterAbi = JSON.parse(readFileSync("./abi/camelotRouterAbi.json"));
const multicallABI = JSON.parse(readFileSync("./abi/multicallAbi.json"));
const erc20ABI = JSON.parse(readFileSync("./abi/erc20Abi.json"));
const account = JSON.parse(readFileSync("./account.json"));



export async function checkInternalFee (web3,token1, token2,ammountIn) {

    
	let camellotRouterContract = new web3.eth.Contract(
		camelotRouterAbi,
		"0xc873fEcbd354f5A56E00E710B90EF4201db2448d"
	);

  
	let amountOut = await camellotRouterContract.methods.getAmountsOut(ammountIn,[token1,token2]).call();


	let amountOut2 = await camellotRouterContract.methods.getAmountsOut(amountOut[1],[token2,token1]).call();


	let fees =  ammountIn - amountOut2[1];

      
	if (fees / ammountIn * 100 < 3 ){
		console.log("Fees test passed");
		return true;
	}else{
		console.log("Fees test failed");
		return false;
	}

  
}


export async function checkHoneyPot  (web3,token, ammountIn , multicallAddress)  {
	try {

		let WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

		let data = [];
		let tos = [];


		let multicallContract = new web3.eth.Contract(
			multicallABI,
			multicallAddress
		);

		let camellotRouterContract = new web3.eth.Contract(
			camelotRouterAbi,
			"0xc873fEcbd354f5A56E00E710B90EF4201db2448d"
		);

		let WETHContract = new web3.eth.Contract(
			erc20ABI,
			WETH
		);


		let token2Contract = new web3.eth.Contract(
			erc20ABI,
			token
		);




		let transferEncoded = WETHContract.methods.transferFrom(account.address,multicallContract._address,ammountIn).encodeABI();

		tos.push(WETH);
		data.push(transferEncoded);

		let approveEncoded = WETHContract.methods.approve(camellotRouterContract._address,ammountIn).encodeABI();

		tos.push(WETH);
		data.push(approveEncoded);

		let swapEncoded = camellotRouterContract.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(ammountIn,0,[WETH,token],multicallContract._address,multicallContract._address,Date.now() + 1000 * 60 * 10).encodeABI();

		let amountOut = await camellotRouterContract.methods.getAmountsOut(ammountIn,[WETH,token]).call();

		tos.push(camellotRouterContract._address);
		data.push(swapEncoded);


		let forgeApprove = token2Contract.methods.approve(camellotRouterContract._address,amountOut[1]).encodeABI();

		tos.push(token);
		data.push(forgeApprove);

		let swap2Encoded = camellotRouterContract.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(amountOut[1],0,[token,WETH],account.address,account.address,Date.now() + 1000 * 60 * 10).encodeABI();

		tos.push(camellotRouterContract._address);
		data.push(swap2Encoded);



		let mullticalldata = await multicallContract.methods.multicall(tos,data).call();

		if (mullticalldata) {
			console.log("this token is not a honeypot");
			return true;

		}
	}
	catch (error) {
		console.log("this token is a honeypot");
		return false;
	}
}








export async function  isVerified (tokenAddress , arbiscanApiKey) {
	try {
		let res = await fetch("https://api.arbiscan.io/api?module=contract&action=getsourcecode&address=" + tokenAddress + "&apikey=" + arbiscanApiKey );
		let json = await res.json();
		let result = json["result"][0]["ABI"];
		if(result.toString() == "Contract source code not verified"){
			console.log(tokenAddress+ ": not verified");
			return false;
		}
		else{
			console.log(tokenAddress+ ": verified");
			return true;
		}
	}
	catch (error) {
		console.log(error);
	}
}