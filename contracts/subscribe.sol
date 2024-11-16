// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract PayFlipSubscriptions is Ownable, ReentrancyGuard {    
    enum UserRole { NONE, BUYER, MERCHANT }
    
    struct User {
        address userAddress;
        uint256 userId;
        UserRole role;
        bool isActive;
        uint256[] activeSubscriptions;
        uint256[] subscriptionHistory;
    }
    
    struct Product {
        uint256 productId;
        string name;        
        uint256 priceUSD;
        uint256 durationDays;
        address merchant;
        bool active;
    }

    struct ProductAnalytics {
        uint256 productId;
        uint256 activeSubscribers;
        uint256 totalRevenue;
        uint256 totalHistoricalSubscribers;
        address[] subscriberAddresses;
        uint256 lastSubscriptionDate;
    }
    
    struct Subscription {
        uint256 productId;
        uint256 startDate;
        uint256 endDate;
        bool active;
        uint256 lastPaymentDate;
        uint256 lastPaymentAmount;
    }
    
    // Simple counters
    uint256 private _productIds;
    uint256 private _userIds;
    
    // Mappings
    mapping(address => User) public users;
    mapping(uint256 => User) public usersById;
    mapping(UserRole => address[]) public usersByRole;
    mapping(uint256 => Product) public products;
    mapping(address => mapping(uint256 => Subscription)) public subscriptions;
    mapping(address => uint256[]) internal merchantProducts;
    
    // External contracts
    IERC20 public immutable USDC;
    AggregatorV3Interface public immutable usdcPriceFeed;
    
    // Events
    event UserRegistered(
        address indexed userAddress,
        uint256 indexed userId,
        UserRole role
    );
    
    event UserDeactivated(address indexed userAddress);
    event UserReactivated(address indexed userAddress);
    
    event ProductCreated(
        uint256 indexed productId,
        string name,
        uint256 priceUSD,
        uint256 durationDays,
        address merchant
    );
    
    event SubscriptionStarted(
        address indexed subscriber,
        uint256 indexed productId,
        uint256 startDate,
        uint256 endDate,
        uint256 paymentAmount
    );
    
    event SubscriptionRenewed(
        address indexed subscriber,
        uint256 indexed productId,
        uint256 newEndDate,
        uint256 paymentAmount
    );
    
    event SubscriptionCancelled(
        address indexed subscriber,
        uint256 indexed productId,
        uint256 cancellationDate
    );
    
    // Modifiers
    modifier onlyRegisteredUser() {
        require(users[msg.sender].isActive, "User is not registered or active");
        _;
    }
    
    modifier onlyBuyer() {
        require(users[msg.sender].role == UserRole.BUYER, "User is not a buyer");
        _;
    }
    
    modifier onlyMerchant() {
        require(users[msg.sender].role == UserRole.MERCHANT, "User is not a merchant");
        _;
    }
    
    modifier productExists(uint256 productId) {
        require(products[productId].merchant != address(0), "Product does not exist");
        _;
    }
    
    modifier onlyProductMerchant(uint256 productId) {
        require(products[productId].merchant == msg.sender, "Not product merchant");
        _;
    }
    
    modifier productActive(uint256 productId) {
        require(products[productId].active, "Product is not active");
        _;
    }
    
    constructor(
        address _usdcPriceFeed,
        address _usdcToken
    ) Ownable(msg.sender) {
        usdcPriceFeed = AggregatorV3Interface(_usdcPriceFeed);
        USDC = IERC20(_usdcToken);
    }
    
    // User Management
    function registerUser(UserRole role) external {
        require(users[msg.sender].userAddress == address(0), "User already registered");
        require(role == UserRole.BUYER || role == UserRole.MERCHANT, "Invalid role");
        
        _userIds += 1;
        uint256 newUserId = _userIds;
        
        users[msg.sender] = User({
            userAddress: msg.sender,
            userId: newUserId,
            role: role,
            isActive: true,
            activeSubscriptions: new uint256[](0),
            subscriptionHistory: new uint256[](0)
        });
        
        usersById[newUserId] = users[msg.sender];
        usersByRole[role].push(msg.sender);
        
        emit UserRegistered(msg.sender, newUserId, role);
    }

    function getUser(address userAddress) 
        external 
        view 
        returns (
            address _userAddress,
            uint256 userId,
            UserRole role,
            bool isActive,
            uint256[] memory activeSubscriptions,
            uint256[] memory subscriptionHistory
        ) 
    {
        User storage user = users[userAddress];
        require(user.userAddress != address(0), "User not found");
        
        return (
            user.userAddress,
            user.userId,
            user.role,
            user.isActive,
            user.activeSubscriptions,
            user.subscriptionHistory
        );
    }
    
    // Product Management
    function createProduct(
        string memory name,
        uint256 priceUSD,
        uint256 durationDays
    ) external onlyMerchant returns (uint256) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(priceUSD > 0, "Price must be greater than 0");
        require(durationDays > 0, "Duration must be greater than 0");
        
        _productIds += 1;
        uint256 newProductId = _productIds;
        
        products[newProductId] = Product({
            productId: newProductId,
            name: name,
            priceUSD: priceUSD,
            durationDays: durationDays,
            merchant: msg.sender,
            active: true
        });
        
        merchantProducts[msg.sender].push(newProductId);
        
        emit ProductCreated(
            newProductId,
            name,
            priceUSD,
            durationDays,
            msg.sender
        );
        
        return newProductId;
    }
    
    // Subscription Management
    function subscribe(uint256 productId) 
        external 
        onlyBuyer
        productExists(productId)
        productActive(productId)
        nonReentrant 
    {
        require(subscriptions[msg.sender][productId].active == false, "Active subscription exists");
        
        Product storage product = products[productId];
        uint256 usdcPaymentAmount = convertUSDToUSDC(product.priceUSD);
        
        require(
            USDC.transferFrom(msg.sender, product.merchant, usdcPaymentAmount),
            "USDC transfer failed"
        );
        
        uint256 startDate = block.timestamp;
        uint256 endDate = startDate + (product.durationDays * 1 days);
        
        // Create subscription
        subscriptions[msg.sender][productId] = Subscription({
            productId: productId,
            startDate: startDate,
            endDate: endDate,
            active: true,
            lastPaymentDate: startDate,
            lastPaymentAmount: usdcPaymentAmount
        });
        
        // Update user's subscription tracking
        User storage user = users[msg.sender];
        user.activeSubscriptions.push(productId);
        user.subscriptionHistory.push(productId);
        
        emit SubscriptionStarted(
            msg.sender,
            productId,
            startDate,
            endDate,
            usdcPaymentAmount
        );
    }
    
    // Price conversion
    function convertUSDToUSDC(uint256 _priceInUSD) public view returns (uint256) {
        (, int256 usdcPriceInUSD, , , ) = usdcPriceFeed.latestRoundData();
        require(usdcPriceInUSD > 0, "Invalid USDC price");
        uint256 usdcPriceInUSDWei = uint256(usdcPriceInUSD);
        return (_priceInUSD * 1e18) / usdcPriceInUSDWei;
    }
    
    // Internal helper functions
    function _getMerchantProducts(address merchant) 
        internal 
        view 
        returns (uint256[] memory) 
    {
        return merchantProducts[merchant];
    }

    // Analytics and View Functions
    function getUserSubscriptions(address userAddress)
        external
        view
        returns (uint256[] memory active, uint256[] memory history)
    {
        User storage user = users[userAddress];
        require(user.userAddress != address(0), "User not found");
        return (user.activeSubscriptions, user.subscriptionHistory);
    }
    
    function getMerchantProducts(address merchant)
        external
        view
        returns (uint256[] memory)
    {
        return _getMerchantProducts(merchant);
    }

    function getAllProducts() external view returns (Product[] memory) {
        // Create array to hold all active products
        Product[] memory allProducts = new Product[](_productIds);
        uint256 activeCount = 0;
        
        // Iterate through all products and add them to the array
        for (uint256 i = 1; i <= _productIds; i++) {
            Product storage product = products[i];
            if (product.merchant != address(0)) { // Check if product exists
                allProducts[activeCount] = product;
                activeCount++;
            }
        }
        
        // Create and return array with exact size of active products
        Product[] memory activeProducts = new Product[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            activeProducts[i] = allProducts[i];
        }
        
        return activeProducts;
    }

    function getProductAnalytics(uint256 productId) 
        public 
        view 
        onlyProductMerchant(productId)
        returns (ProductAnalytics memory) 
    {
        // First pass: count active subscribers to allocate array
        uint256 activeCount = 0;
        for (uint256 i = 0; i < usersByRole[UserRole.BUYER].length; i++) {
            address subscriber = usersByRole[UserRole.BUYER][i];
            if (subscriptions[subscriber][productId].active) {
                activeCount++;
            }
        }

        // Initialize analytics with proper array size
        ProductAnalytics memory analytics = ProductAnalytics({
            productId: productId,
            activeSubscribers: 0,
            totalRevenue: 0,
            totalHistoricalSubscribers: 0,
            subscriberAddresses: new address[](activeCount),
            lastSubscriptionDate: 0
        });
        
        // Second pass: fill in the data
        uint256 subscriberIndex = 0;
        for (uint256 i = 0; i < usersByRole[UserRole.BUYER].length; i++) {
            address subscriber = usersByRole[UserRole.BUYER][i];
            Subscription storage sub = subscriptions[subscriber][productId];
            
            if (sub.startDate > 0) {
                analytics.totalHistoricalSubscribers++;
                
                if (sub.active) {
                    analytics.activeSubscribers++;
                    analytics.totalRevenue += sub.lastPaymentAmount;
                    analytics.subscriberAddresses[subscriberIndex] = subscriber;
                    subscriberIndex++;
                }
                
                if (sub.startDate > analytics.lastSubscriptionDate) {
                    analytics.lastSubscriptionDate = sub.startDate;
                }
            }
        }
        
        return analytics;
    }

    function getMerchantAnalytics(address merchant) 
        external 
        view 
        returns (ProductAnalytics[] memory) 
    {
        require(
            users[merchant].role == UserRole.MERCHANT,
            "Address is not a merchant"
        );
        
        uint256[] memory merchantProductIds = _getMerchantProducts(merchant);
        ProductAnalytics[] memory allAnalytics = new ProductAnalytics[](merchantProductIds.length);
        
        for (uint256 i = 0; i < merchantProductIds.length; i++) {
            allAnalytics[i] = getProductAnalytics(merchantProductIds[i]);
        }
        
        return allAnalytics;
    }
}