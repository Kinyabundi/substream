'use client';

import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownBasename,
  WalletDropdownFundLink,
  WalletDropdownLink,
  WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import {
  Address,
  Avatar,
  Name,
  Identity,
  EthBalance,
} from '@coinbase/onchainkit/identity';
import { TokenImage } from '@coinbase/onchainkit/token';
import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useState } from 'react';
import Moralis from 'moralis';
import { EvmChain } from "@moralisweb3/common-evm-utils";
interface Token {
    symbol: string;
    formatted_balance: string;
}

export function WalletComponents() {

  const { user } = useAuth();
  const [balances, setBalances] = useState<Array<Token>>([]);

  useEffect(() => {
      const initializeMoralis = async () => {
          if (!Moralis.Core.isStarted) {
              await Moralis.start({
                  apiKey: "P1ZvrguGccwivEz7eObhSySzgrVUptRqaZoNigQy7XRwKUoHewAMTA7B37k4P3Rk",
              });
          }
      };

      initializeMoralis();
  }, []);

  useEffect(() => {
      const getBalance = async () => {
          if (user?.address) {
              console.log(user?.address)
              try {
                  const address = user.address;
                  const chain = EvmChain.BASE_SEPOLIA;

                  const response = await Moralis.EvmApi.token.getWalletTokenBalances({
                      address,
                      chain
                  });

                  const formattedBalances = response.toJSON().map((token) => ({
                      ...token,
                      formatted_balance: (parseInt(token.balance) / Math.pow(10, token.decimals)).toFixed(token.decimals)
                  }));

                  setBalances(formattedBalances);
                  console.log(user?.address)

                  console.log(formattedBalances);
              } catch (error) {
                  console.error("Error fetching balances:", error);
              }
          }
      };

      getBalance();
  }, [user]);

  const renderBalance = (token: Token) => {
    if (token.symbol.toLowerCase() === 'usdc' && parseFloat(token.formatted_balance) === 0) {
      return "Zero balance";
    }
    return token.formatted_balance;
  };

  return (
    <div className="flex justify-end">
      <Wallet>
        <ConnectWallet className='bg-[#F09F24]'>
          <Avatar className="h-6 w-6" />
          <Name />
        </ConnectWallet>
        <WalletDropdown className=''>
          <Identity
            className="px-4 pt-3 pb-2"
            hasCopyAddressOnClick
          >
            <Avatar className='bg-[#F09F24]' />
            <Name />
            <Address />
            <EthBalance />
          </Identity>
         <div className='flex flex-row gap-4'>
         <TokenImage
                token={  {
                    name: 'USDC',
                    address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                    symbol: 'USDC',
                    decimals: 6,
                    image:
                      'https://d3r81g40ycuhqg.cloudfront.net/wallet/wais/44/2b/442b80bd16af0c0d9b22e03a16753823fe826e5bfd457292b55fa0ba8c1ba213-ZWUzYjJmZGUtMDYxNy00NDcyLTg0NjQtMWI4OGEwYjBiODE2',
                    chainId: 8453,
                  }}
                size={32}
                className='ml-4'
            />
              <ul>
                {balances.map((token, index) => (
                    <li key={index} className='font-bold text-xl text-[#000]'>
                        {renderBalance(token)}
                    </li>
                ))}
            </ul>
         </div>
          <WalletDropdownBasename />
          <WalletDropdownLink
            icon="wallet"
            href="https://keys.coinbase.com"
          >
            Wallet
          </WalletDropdownLink>
          <WalletDropdownFundLink />
          <WalletDropdownDisconnect />
        </WalletDropdown>
      </Wallet>


    </div>
  );
}