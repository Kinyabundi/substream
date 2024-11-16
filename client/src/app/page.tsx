'use client';

import React, { useState, useEffect } from 'react';
import { WalletComponents } from "@/components/OnchainkitComponents/WalletComponent";
import { useAuth } from "@/context/AuthContext";
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes, CircleDollarSign, Shield, Sparkles, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import RoleSelectionModal from '../components/modal/role';
import { useReadContract } from 'wagmi'
import { contractABI, ContractAddress } from '@/constants/abi';

export default function LandingPage() {
  const { user } = useAuth();
  const { openConnectModal } = useConnectModal();
  const [showRoleModal, setShowRoleModal] = useState(false);
  const router = useRouter();
  const [userdata, setUserdata] = useState<{ [key: string]: any }>({})

  const features = [
    {
      title: "Secure Payments",
      description: "USDC-powered subscription payments with smart contract security",
      icon: <Shield className="h-12 w-12 text-primary" />
    },
    {
      title: "AI-Powered",
      description: "Intelligent subscription management and renewal optimization",
      icon: <Sparkles className="h-12 w-12 text-primary" />
    },
    {
      title: "Multi-Product",
      description: "Manage multiple subscriptions from different providers",
      icon: <Boxes className="h-12 w-12 text-primary" />
    },
    {
      title: "Revenue Analytics",
      description: "Real-time analytics and revenue tracking for merchants",
      icon: <CircleDollarSign className="h-12 w-12 text-primary" />
    }
  ];

  const {
    data: userData,
    isLoading,
    isError
  } = useReadContract({
    abi: contractABI,
    address: ContractAddress,
    functionName: 'getUser',
    args: [user?.address as `0x${string}`]
    });

  useEffect(() => {
    if (userData && user) {
      const [userAddress, userId, role, isActive, activeSubscriptions, subscriptionHistory] = userData;
      
      // Update user context with contract data
      setUserdata({
        ...user,
        contractData: {
          userId: Number(userId),
          role: Number(role),
          isActive,
          activeSubscriptions: activeSubscriptions.map(Number),
          subscriptionHistory: subscriptionHistory.map(Number)
        }
      });

      // Handle redirects based on role
      if (isActive) {
        if (Number(role) === 1) {
          router.push('/app/buyer-dashboard');
        } else if (Number(role) === 2) {
          router.push('/app/merchant-dashboard');
        }
      }
    }
  }, [userData, user, setUserdata, router]);

  const handleGetStarted = () => {
    if (user?.isConnected) {
      if (!userData) {
        setShowRoleModal(true);
      }
    } else {
      openConnectModal?.();
    }
  };

  // Show loading state while checking user data
  if (user?.isConnected && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <nav className="border-b bg-white/70 backdrop-blur-lg fixed top-0 w-full z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Boxes className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-primary">SubStream</span>
          </div>
          <div className="flex items-center gap-4">
            <WalletComponents />
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <Badge className="mb-4" variant="outline">Web3 Native</Badge>
          <h1 className="text-5xl font-bold mb-6">
            Subscription Management,
            <span className="text-primary block mt-2">Reimagined for Web3</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Create, manage, and optimize your subscription business with AI-powered insights and secure USDC payments.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={handleGetStarted}>
              {user?.isConnected ? 'Get Started' : 'Connect Wallet'}
            </Button>
            <Button>
              Learn More
            </Button>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose SubStream?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-2">
                <CardHeader>
                  <div className="mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <RoleSelectionModal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        address={user?.address || ''}
      />
    </div>
  );
}