import { Metadata } from "next";
import BuyerDashboard from "../_components/BuyerDashboard";

export const metadata: Metadata = {
	title: "CreateAccount",
};

export default function page() {
	return <BuyerDashboard />;
}