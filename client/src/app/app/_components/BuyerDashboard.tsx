'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Store,
  Clock,
  CreditCard,
  Loader2,
  AlertCircle,
  ShoppingCart,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { WalletComponents } from "@/components/OnchainkitComponents/WalletComponent";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { contractABI, ContractAddress } from '@/constants/abi';
import toast from 'react-hot-toast';

const USDC_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// Change this according to your network
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// Types
interface Product {
  productId: bigint;
  name: string;
  priceUSD: bigint;
  durationDays: bigint;
  merchant: string;
  active: boolean;
}

interface Subscription {
  productId: bigint;
  startDate: bigint;
  endDate: bigint;
  active: boolean;
  lastPaymentDate: bigint;
  lastPaymentAmount: bigint;
}

interface UserData {
  userAddress: string;
  userId: bigint;
  role: number;
  isActive: boolean;
  activeSubscriptions: readonly bigint[];
  subscriptionHistory: readonly bigint[];
}

export default function BuyerDashboard() {
  // State
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Contract Hooks
  const { writeContract, data: hash, error: writeError } = useWriteContract();
  
  const { isLoading: isTransactionPending, isSuccess: isTransactionSuccess } = 
    useWaitForTransactionReceipt({
      hash,
    });

  // Get user data
  const {
    data: userData,
    isLoading: isLoadingUserData,
    refetch: refetchUserData
  } = useReadContract({
    abi: contractABI,
    address: ContractAddress,
    functionName: 'getUser',
    args: [user?.address as `0x${string}`],
    enabled: !!user?.address,
  });

  // Get user subscriptions
  const {
    data: userSubscriptions,
    isLoading: isLoadingSubscriptions,
    refetch: refetchSubscriptions
  } = useReadContract({
    abi: contractABI,
    address: ContractAddress,
    functionName: 'getUserSubscriptions',
    args: [user?.address as `0x${string}`],
    enabled: !!user?.address,
  });

  // Get all products
  const {
    data: products,
    isLoading: isLoadingProducts,
    refetch: refetchProducts
  } = useReadContract({
    abi: contractABI,
    address: ContractAddress,
    functionName: 'getAllProducts',
    enabled: !!user?.address,
  });

  // Get USDC amount for selected product
  const {
    data: usdcAmount,
    isLoading: isLoadingUsdcAmount,
  } = useReadContract({
    abi: contractABI,
    address: ContractAddress,
    functionName: 'convertUSDToUSDC',
    args: [selectedProduct?.priceUSD || 0n],
    enabled: !!selectedProduct,
  });

  // Effects
  useEffect(() => {
    if (!userData && user?.address) {
      handleRegisterUser();
    }
  }, [userData, user?.address]);

  useEffect(() => {
    if (isTransactionSuccess) {
      if (isApproving) {
        toast.success("USDC approved successfully!");
        setIsApproving(false);
        handleSubscribe();
      } else if (isSubscribing) {
        toast.success("Successfully subscribed!");
        setIsModalOpen(false);
        setIsSubscribing(false);
        refetchUserData();
        refetchSubscriptions();
        refetchProducts();
      }
    }
  }, [isTransactionSuccess, refetchUserData, refetchSubscriptions, refetchProducts]);

  useEffect(() => {
    if (writeError) {
      toast.error("Transaction failed. Please try again.");
      setIsSubscribing(false);
      setIsRegistering(false);
      setIsApproving(false);
    }
  }, [writeError]);

  // Utility Functions
  const formatUSDC = (amount: bigint): string => {
    return `${Number(amount) / 1_000_000} USDC`;
  };

  const formatDays = (days: bigint): string => {
    return `${days.toString()} days`;
  };

  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleRegisterUser = async () => {
    if (!user?.address) return;
    setIsRegistering(true);

    try {
      writeContract({
        abi: contractABI,
        address: ContractAddress,
        functionName: 'registerUser',
        args: [0], // 0 for BUYER role
      });
    } catch (err) {
      console.error('Error registering user:', err);
      toast.error("Failed to register. Please try again.");
      setIsRegistering(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedProduct || !user?.address || !usdcAmount) return;
    setIsApproving(true);

    try {
      writeContract({
        abi: USDC_ABI,
        address: USDC_ADDRESS,
        functionName: 'approve',
        args: [ContractAddress, usdcAmount],
      });
    } catch (err) {
      console.error('Error approving USDC:', err);
      toast.error("Failed to approve USDC. Please try again.");
      setIsApproving(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedProduct || !user?.address) return;
    setIsSubscribing(true);

    try {
      writeContract({
        abi: contractABI,
        address: ContractAddress,
        functionName: 'subscribe',
        args: [selectedProduct.productId],
      });
    } catch (err) {
      console.error('Error subscribing:', err);
      toast.error("Failed to subscribe. Please try again.");
      setIsSubscribing(false);
    }
  };

  const isSubscribed = (productId: bigint): boolean => {
    if (!userSubscriptions) return false;
    return userSubscriptions[0].includes(productId);
  };

  // Render Methods
  const renderHeader = () => (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-2xl font-bold">Available Subscriptions</h1>
        <p className="text-gray-500">Browse and subscribe to available products</p>
      </div>
      <WalletComponents />
    </div>
  );

  const renderSubscribeModal = () => (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Subscription</DialogTitle>
          <DialogDescription>
            Review your subscription details and approve USDC spending.
          </DialogDescription>
        </DialogHeader>
        
        {selectedProduct && (
          <div className="space-y-4 py-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Product</span>
              <span>{selectedProduct.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Price</span>
              <span>{formatUSDC(selectedProduct.priceUSD)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Duration</span>
              <span>{formatDays(selectedProduct.durationDays)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Merchant</span>
              <span>{formatAddress(selectedProduct.merchant)}</span>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Subscription Steps:</h4>
              <ol className="text-sm space-y-2 text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">1</span>
                  Approve USDC spending
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">2</span>
                  Confirm subscription
                </li>
              </ol>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button 
            onClick={() => setIsModalOpen(false)}
            disabled={isApproving || isSubscribing}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          {isApproving ? (
            <Button disabled className="w-full sm:w-auto">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Approving USDC...
            </Button>
          ) : isSubscribing ? (
            <Button disabled className="w-full sm:w-auto">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Subscribing...
            </Button>
          ) : (
            <Button 
              onClick={handleApprove}
              className="w-full sm:w-auto"
            >
              Start Subscription
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const renderActiveSubscriptions = () => {
    if (!userSubscriptions || userSubscriptions[0].length === 0) return null;

    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Active Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userSubscriptions[0].map((subProductId) => {
              const product = products?.find(p => p.productId === subProductId);
              if (!product) return null;

              return (
                <div 
                  key={subProductId.toString()}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium">{product.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatUSDC(product.priceUSD)} • {formatDays(product.durationDays)}
                    </p>
                  </div>
                  <Badge>Active</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderProductGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {(isLoadingProducts || isLoadingSubscriptions || isLoadingUserData) ? (
        <div className="col-span-full flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : !products || products.length === 0 ? (
        <div className="col-span-full text-center py-12 text-gray-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p className="text-lg font-medium">No Products Available</p>
          <p>Check back later for new subscription offerings.</p>
        </div>
      ) : (
        products.map((product) => (
          <Card key={product.productId.toString()}>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>{product.name}</CardTitle>
                <Badge variant={product.active ? 'default' : 'secondary'}>
                  {isSubscribed(product.productId) ? 'Subscribed' : product.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span>Price</span>
                </div>
                <span className="font-medium">{formatUSDC(product.priceUSD)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Duration</span>
                </div>
                <span className="font-medium">{formatDays(product.durationDays)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  <span>Merchant</span>
                </div>
                <span className="font-medium">{formatAddress(product.merchant)}</span>
              </div>
              <Button
                className="w-full"
                disabled={!product.active || isSubscribed(product.productId)}
                onClick={() => {
                  setSelectedProduct(product);
                  setIsModalOpen(true);
                }}
              >
                {isSubscribed(product.productId) ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Subscribed
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Subscribe Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
  if (!user?.address) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 mb-4">
              Please connect your wallet to browse available subscriptions.
            </p>
            <WalletComponents />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isRegistering) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Setting Up Your Account</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-gray-500">Please wait while we set up your account...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto py-8 px-4">
        {renderHeader()}
        {renderActiveSubscriptions()}
        {renderProductGrid()}
        {renderSubscribeModal()}
      </main>
    </div>
  );
}