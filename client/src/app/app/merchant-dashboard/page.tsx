import { Metadata } from "next";
import MerchantDashboard from "../_components/MerchantDashboard";

export const metadata: Metadata = {
	title: "CreateAccount",
};

export default function page() {
	return <MerchantDashboard />;
}