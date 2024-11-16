'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Users,
  BarChart,
  PlusCircle,
  Settings,
  LogOut,
  ChevronRight,
  LineChart,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { WalletComponents } from "@/components/OnchainkitComponents/WalletComponent";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { contractABI, ContractAddress } from '@/constants/abi';
import toast from 'react-hot-toast';

// Types
interface Product {
  productId: bigint;
  name: string;
  priceUSD: bigint;
  durationDays: bigint;
  merchant: string;
  active: boolean;
}

interface ProductAnalytics {
  productId: bigint;
  activeSubscribers: bigint;
  totalRevenue: bigint;
  totalHistoricalSubscribers: bigint;
  subscriberAddresses: readonly `0x${string}`[]; // Changed to readonly
  lastSubscriptionDate: bigint;
}

interface NewProduct {
  name: string;
  price: string;
  duration: string;
}

export default function MerchantDashboard() {
  // State
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: '',
    price: '',
    duration: '30'
  });

  // Contract Hooks
  const { writeContract, data: hash, error: writeError } = useWriteContract();
  
  const { isLoading: isTransactionPending, isSuccess: isTransactionSuccess } = 
    useWaitForTransactionReceipt({
      hash,
    });

  // Get merchant products
  const {
    data: merchantProductIds,
    isLoading: isLoadingProducts,
    refetch: refetchProducts
  } = useReadContract({
    abi: contractABI,
    address: ContractAddress,
    functionName: 'getMerchantProducts',
    args: [user?.address as `0x${string}`]
  });

  // Get merchant analytics
  const {
    data: merchantAnalytics,
    isLoading: isLoadingAnalytics,
    refetch: refetchAnalytics
  } = useReadContract({
    abi: contractABI,
    address: ContractAddress,
    functionName: 'getMerchantAnalytics',
    args: [user?.address as `0x${string}`]
    });

  // Effects
  useEffect(() => {
    if (isTransactionSuccess) {
      toast.success("Product created successfully!");
      setIsModalOpen(false);
      setIsSubmitting(false);
      refetchProducts();
      refetchAnalytics();
      setNewProduct({
        name: '',
        price: '',
        duration: '30'
      });
    }
  }, [isTransactionSuccess, refetchProducts, refetchAnalytics]);

  useEffect(() => {
    if (writeError) {
      toast.error("Failed to create product. Please try again.");
      setIsSubmitting(false);
    }
  }, [writeError]);

  // Utility Functions
  const formatUSDC = (amount: bigint): string => {
    return `${Number(amount) / 1_000_000} USDC`;
  };

  const calculateGrowth = (analytics: ProductAnalytics): "growing" | "declining" => {
    return Number(analytics.activeSubscribers) > 0 ? "growing" : "declining";
  };

  const getTotalRevenue = (): string => {
    if (!merchantAnalytics) return "0";
    return formatUSDC(
      merchantAnalytics.reduce(
        (sum, product) => sum + product.totalRevenue, 
        BigInt(0)
      )
    );
  };

  const getTotalSubscribers = (): number => {
    if (!merchantAnalytics) return 0;
    return merchantAnalytics.reduce(
      (sum, product) => sum + Number(product.activeSubscribers),
      0
    );
  };

  const getRevenueChartData = () => {
    if (!merchantAnalytics) return [];
    
    // Create time-based revenue data
    return merchantAnalytics.map((product, index) => ({
      name: `Product ${String(product.productId)}`,
      revenue: Number(product.totalRevenue) / 1_000_000,
    }));
  };

  // Handlers
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const priceInSmallestUnit = BigInt(Math.floor(parseFloat(newProduct.price) * 1_000_000));
      const durationInDays = BigInt(newProduct.duration);

      writeContract({
        abi: contractABI,
        address: ContractAddress,
        functionName: 'createProduct',
        args: [newProduct.name, priceInSmallestUnit, durationInDays],
      });
    } catch (err) {
      console.error('Error creating product:', err);
      toast.error("Failed to create product. Please check your inputs and try again.");
      setIsSubmitting(false);
    }
  };

  // Render Methods
  const renderSidebar = () => (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r p-4">
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-8">
          <Store className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Merchant Portal</span>
        </div>
        
        <nav className="flex-1">
          <div className="space-y-1">
            <Button className="w-full justify-start">
              <BarChart className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button className="w-full justify-start">
              <Store className="mr-2 h-4 w-4" />
              Products
            </Button>
            <Button className="w-full justify-start">
              <Users className="mr-2 h-4 w-4" />
              Subscribers
            </Button>
            <Button className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </nav>
        
        <div className="mt-auto">
          <Button className="w-full justify-start text-red-500 hover:text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </div>
    </aside>
  );

  const renderHeader = () => (
    <div className="flex justify-between items-center mb-8">
      <div>
        <h1 className="text-2xl font-bold">Merchant Dashboard</h1>
        <p className="text-gray-500">{user?.address}</p>
      </div>
      <div className="flex items-center gap-4">
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Product
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddProduct}>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>
                  Create a new subscription product for your customers.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter product name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price (USDC)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.000001"
                    min="0"
                    placeholder="Enter price in USDC"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duration (days)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    placeholder="Enter duration in days"
                    value={newProduct.duration}
                    onChange={(e) => setNewProduct({...newProduct, duration: e.target.value})}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isSubmitting || !newProduct.name || !newProduct.price || !newProduct.duration}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Product'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <WalletComponents />
      </div>
    </div>
  );

  const renderOverviewCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500">
            Total Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingAnalytics ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              getTotalRevenue()
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500">
            Active Subscribers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingAnalytics ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              getTotalSubscribers()
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500">
            Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingProducts ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              merchantProductIds?.length || 0
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-500">
            Product Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoadingAnalytics ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : merchantAnalytics?.some(
              analytics => calculateGrowth(analytics) === "growing"
            ) ? (
              <div className="text-green-600 flex items-center">
                <ArrowUp className="h-4 w-4 mr-1" />
                Growing
              </div>
            ) : (
              <div className="text-red-600 flex items-center">
                <ArrowDown className="h-4 w-4 mr-1" />
                Needs Attention
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderRevenueChart = () => (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Revenue By Product</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {isLoadingAnalytics ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={getRevenueChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `${value} USDC`} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" />
              </RechartsLineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderProductsOverview = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Products Overview</CardTitle>
          <Button onClick={() => setIsModalOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Product
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingAnalytics ? (
          <div className="flex justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !merchantAnalytics || merchantAnalytics.length === 0 ? (
          <div className="text-center py-6 text-gray-500 flex flex-col items-center gap-2">
            <AlertCircle className="h-8 w-8" />
            <p>No products found. Create your first product to get started!</p>
            <Button 
              onClick={() => setIsModalOpen(true)}
              className="mt-2"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Product
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {merchantAnalytics.map((analytics) => (
              <div
                key={String(analytics.productId)}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <Store className="h-8 w-8 text-gray-400" />
                  <div>
                    <h3 className="font-medium">Product {String(analytics.productId)}</h3>
                    <p className="text-sm text-gray-500">
                      {analytics.activeSubscribers.toString()} active subscribers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">{formatUSDC(analytics.totalRevenue)}</p>
                    <p className="text-sm text-gray-500">Total Revenue</p>
                  </div>
                  <Badge
                    variant={calculateGrowth(analytics) === "growing" ? "default" : "destructive"}
                    className="ml-2"
                  >
                    {calculateGrowth(analytics) === "growing" ? (
                      <ArrowUp className="h-4 w-4 mr-1" />
                    ) : (
                      <ArrowDown className="h-4 w-4 mr-1" />
                    )}
                    {calculateGrowth(analytics) === "growing" ? "Growing" : "Declining"}
                  </Badge>
                    <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Main render
  if (!user?.address) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 mb-4">
              Please connect your wallet to access the merchant dashboard.
            </p>
            <WalletComponents />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderSidebar()}
      <main className="pl-64 p-8">
        {renderHeader()}
        {renderOverviewCards()}
        {renderRevenueChart()}
        {renderProductsOverview()}
      </main>
    </div>
  );
}