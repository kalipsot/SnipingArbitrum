import { readFileSync } from "fs";
const erc20ABI = JSON.parse(readFileSync("./abi/erc20ABI.json"));




export async function swap (wb3,ammountIn, path ,routerContract, account)   {
	console.log("== New swap ==");
	let token1contract = new wb3.eth.Contract(erc20ABI, path[0]);
	let approve = token1contract.methods.approve(
		routerContract._address,
		ammountIn
	);
	let encodedABI = approve.encodeABI();
	let approvegas = await wb3.eth.estimateGas({"from": account.address,"to": token1contract._address, "data": encodedABI});
	let tx = {
		from: account.address,
		to: token1contract._address,
		gas: approvegas,
		data: encodedABI,
	};
	let approvesignedTx =
      await wb3.eth.accounts.signTransaction(
      	tx,
      	account.privateKey
      );
	wb3.eth.sendSignedTransaction(approvesignedTx.rawTransaction)
		.on("transactionHash", function (hash) {
			console.log("== Aprove tx ==");
			console.log(hash);
		})
		.on("receipt", async function () {
			console.log("== starting to swap ==");
			let swap =
        routerContract.methods.swapExactTokensForTokensSupportingFeeOnTransferTokens(
        	ammountIn,
        	0,
        	path,
        	account.address,
        	account.address,
        	Date.now() + 1000 * 60 * 10
        );
			let encodedABI = swap.encodeABI();

			let swapGas = await wb3.eth.estimateGas({"from": account.address,"to": routerContract._address, "data": encodedABI});
       
			let tx = {
				from: account.address,
				to: routerContract._address,
				gas: swapGas,
				data: encodedABI,
			};
  
			let sellsignedTx =
          await wb3.eth.accounts.signTransaction(
          	tx,
          	account.privateKey
          );
  
			wb3.eth
				.sendSignedTransaction(sellsignedTx.rawTransaction)
				.on("transactionHash", function (hash) {
					console.log("== swap tx ==");
					console.log(hash);
				})
				.on("receipt", async function (receipt) {
					console.log("== swap suceed ==");

					let decodedlog = wb3.eth.abi.decodeLog(
						[
							{
								type: "uint256",
								name: "amount0In",
							},
							{
								type: "uint256",
								name: "amount1In",
							},
							{
								type: "uint256",
								name: "amount0Out",
							},
							{
								type: "uint256",
								name: "amount1Out",
							},
						],
						receipt.logs[4].data,
						[
							receipt.logs[4].topics[0],
							receipt.logs[4].topics[1],
							receipt.logs[4].topics[2],
						]
					);

					return decodedlog.amount0Out;
				})
				.on("error", function (error, receipt) {
					console.error(
						"Error:",
						error,
						"Receipt:",
						receipt
					);
				});
		});
}