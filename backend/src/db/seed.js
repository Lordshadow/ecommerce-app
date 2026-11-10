const { db, run, queryOne, queryAll } = require('./database');
const { categoryFor } = require('./download-catalog');
const { convertUsdToInr } = require('../currency');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const IMPORTED_CATALOG_PATH = path.join(__dirname, 'catalog-source.json');

const categories = [
  {
    name: 'Electronics & Gadgets',
    slug: 'electronics',
    description: 'Cutting-edge smartphones, tablets, cameras and modern tech accessories.',
    icon: 'Smartphone',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'
  },
  {
    name: 'Audio & Sound',
    slug: 'audio',
    description: 'Audiophile headphones, studio monitors, Bluetooth speakers, and wireless earbuds.',
    icon: 'Headphones',
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=80'
  },
  {
    name: 'Computers & Office',
    slug: 'computers',
    description: 'High-performance laptops, mechanical keyboards, ergonomic monitors, and workspace essentials.',
    icon: 'Laptop',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'
  },
  {
    name: 'Fashion & Apparel',
    slug: 'fashion',
    description: 'Premium casual wear, luxury jackets, handcrafted footwear, and modern everyday essentials.',
    icon: 'Shirt',
    image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800&q=80'
  },
  {
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Artisan espresso makers, air fryers, cast iron cookery, and contemporary kitchen accessories.',
    icon: 'Coffee',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80'
  },
  {
    name: 'Groceries',
    slug: 'groceries',
    description: 'Everyday pantry staples, beverages, and grocery essentials.',
    icon: 'ShoppingBasket',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80'
  },
  {
    name: 'Health & Beauty',
    slug: 'health-beauty',
    description: 'Organic skincare, sonic toothbrushes, aromatherapy diffusers, and luxury grooming kits.',
    icon: 'Sparkles',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80'
  },
  {
    name: 'Sports & Outdoors',
    slug: 'sports-outdoors',
    description: 'Rugged backpacks, insulated flasks, yoga mats, camping tents, and premium fitness gear.',
    icon: 'Activity',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80'
  },
  {
    name: 'Smart Home & Living',
    slug: 'smart-home',
    description: 'Smart lighting, voice assistants, robot vacuums, and connected security systems.',
    icon: 'Home',
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80'
  }
];

const coupons = [
  { code: 'WELCOME10', discount_percent: 10, min_spend: 20 },
  { code: 'SAVE20', discount_percent: 20, min_spend: 80 },
  { code: 'SUPER30', discount_percent: 30, min_spend: 150 },
  { code: 'FLASH50', discount_percent: 50, min_spend: 300 }
];

const demoAccounts = [
  { name: 'Demo Customer One', email: 'demo.customer1@apexstore.local', password: 'Demo-Account-2026!' },
  { name: 'Demo Customer Two', email: 'demo.customer2@apexstore.local', password: 'Demo-Account-2026!' }
];

// 100 Product Seed Dataset
const rawProducts = [
  // 1-15: Electronics & Gadgets
  {
    title: 'Aura Pro 4K Drone with Gimbal Stabilizer',
    category: 'Electronics & Gadgets',
    brand: 'AeroTech',
    price: 499.99,
    original_price: 599.99,
    rating: 4.8,
    reviews_count: 142,
    stock: 14,
    badge: 'Best Seller',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&q=80',
      'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=800&q=80',
      'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&q=80'
    ],
    features: ['True 4K HDR 60fps Video', '3-Axis Mechanical Gimbal', '42-Minute Flight Time', '12km Transmission Range', 'Omnidirectional Obstacle Sensing'],
    tags: ['drone', 'camera', '4k', 'aerial', 'tech'],
    description: 'Capture cinematic footage from anywhere with the Aura Pro 4K Drone. Featuring a high-precision 3-axis mechanical gimbal, AI subject tracking, and up to 42 minutes of flight per charge.'
  },
  {
    title: 'Lumix Alpha Mirrorless Camera Body',
    category: 'Electronics & Gadgets',
    brand: 'OptiPix',
    price: 1199.00,
    original_price: 1399.00,
    rating: 4.9,
    reviews_count: 88,
    stock: 8,
    badge: 'Pro Pick',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
      'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&q=80'
    ],
    features: ['33MP Full-Frame Exmor Sensor', '759-Point Phase Detection AF', 'Real-time Eye AF for Humans & Animals', '4K 60p 10-Bit 4:2:2 Recording', '5-Axis In-Body Image Stabilization'],
    tags: ['camera', 'mirrorless', 'photography', '4k'],
    description: 'The ultimate professional hybrid camera for both stills and filmmaking. Uncompromising sharpness with dual SD card slots and weather-sealed magnesium body.'
  },
  {
    title: 'Nova Ultra Slim Power Bank 25,000mAh',
    category: 'Electronics & Gadgets',
    brand: 'NovaVolt',
    price: 54.99,
    original_price: 69.99,
    rating: 4.7,
    reviews_count: 320,
    stock: 45,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1609592426867-0c677685dc41?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1609592426867-0c677685dc41?w=800&q=80'],
    features: ['100W USB-C Power Delivery', 'Charges 3 Devices Simultaneously', 'Digital LED Battery Gauge', 'Airline Approved 92.5Wh', 'Anodized Aluminum Alloy Finish'],
    tags: ['powerbank', 'battery', 'usb-c', 'fast-charge'],
    description: 'Keep laptops, phones, and consoles powered all day long. Supports fast charging up to 100W for MacBook Pro, Dell XPS, and flagship smartphones.'
  },
  {
    title: 'Titan Smartwatch GPS & Cellular 47mm',
    category: 'Electronics & Gadgets',
    brand: 'TitanWear',
    price: 349.00,
    original_price: 399.00,
    rating: 4.6,
    reviews_count: 210,
    stock: 22,
    badge: 'Trending',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&q=80'
    ],
    features: ['Sapphire Crystal AMOLED Display', 'ECG & Blood Oxygen Monitoring', 'Dual-Frequency High Precision GPS', '100m Water Resistance Dive Rating', '7-Day Battery Life in Smart Mode'],
    tags: ['smartwatch', 'fitness', 'gps', 'wearable'],
    description: 'Rugged titanium construction meets advanced biometric telemetry. Track sports, make calls without your phone, and monitor health metrics 24/7.'
  },
  {
    title: 'Pulse E-Reader 7-inch Warm Light Display',
    category: 'Electronics & Gadgets',
    brand: 'PageGlow',
    price: 139.99,
    original_price: 169.99,
    rating: 4.7,
    reviews_count: 95,
    stock: 18,
    badge: '20% OFF',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=80'],
    features: ['300 PPI Glare-Free Carta E-Ink', 'Adjustable Amber Warm Light', 'IPX8 Waterproof Bath Reading', '32GB Storage for 15,000 Books', '10-Week Battery Life'],
    tags: ['ereader', 'books', 'e-ink', 'portable'],
    description: 'Read comfortably in bright sunlight or pitch darkness. High-resolution E-Ink screen mimics real printed paper without eye fatigue.'
  },
  {
    title: 'AeroGrip Magnetic MagSafe Car Mount',
    category: 'Electronics & Gadgets',
    brand: 'AeroTech',
    price: 29.99,
    original_price: 39.99,
    rating: 4.5,
    reviews_count: 178,
    stock: 60,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800&q=80'],
    features: ['15W Fast Qi Wireless Charging', 'N52 Strong Rare-Earth Magnets', '360° Ball Joint Rotation', 'Vent Clamp with Twist Lock', 'Overheat & Short-Circuit Safety'],
    tags: ['magsafe', 'car', 'mount', 'wireless-charger'],
    description: 'Seamless snap-and-go phone mount with built-in high-speed wireless charging for iPhones and Qi-compatible smartphones.'
  },
  {
    title: 'VisionX Portable 1080p Mini Projector',
    category: 'Electronics & Gadgets',
    brand: 'VisionCraft',
    price: 199.99,
    original_price: 249.99,
    rating: 4.4,
    reviews_count: 84,
    stock: 15,
    badge: 'Hot Deal',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&q=80'],
    features: ['Full HD 1080p Native Resolution', 'Auto Keystone Correction', 'Built-in Hi-Fi Stereo Speakers', 'Cast via Wi-Fi 6 & Bluetooth 5.2', 'Up to 150-inch Display Size'],
    tags: ['projector', 'cinema', 'home-theater', 'gadgets'],
    description: 'Turn your bedroom, living room, or backyard into an IMAX screen. Ultra-compact, quiet cooling, and supports Netflix & YouTube direct streaming.'
  },
  {
    title: 'Starlight Astrophotography Telescope with App Sync',
    category: 'Electronics & Gadgets',
    brand: 'CosmoLens',
    price: 389.00,
    original_price: 450.00,
    rating: 4.8,
    reviews_count: 42,
    stock: 7,
    badge: 'Limited',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&q=80'],
    features: ['80mm Multi-Coated Objective Lens', 'Automated Star Tracking Motor', 'Integrated Smartphone Mount', 'Moon, Planet & Nebula Filters', 'Sturdy Carbon Fiber Tripod'],
    tags: ['telescope', 'astronomy', 'stars', 'optics'],
    description: 'Discover Jupiter moons, Saturn rings, and distant nebulae. Automated motor links with your smartphone for guided celestial navigation.'
  },
  {
    title: 'HyperLink USB-C 10-in-1 Dual 4K Hub',
    category: 'Electronics & Gadgets',
    brand: 'NovaVolt',
    price: 64.99,
    original_price: 79.99,
    rating: 4.6,
    reviews_count: 215,
    stock: 35,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=800&q=80'],
    features: ['Dual 4K@60Hz HDMI Outputs', '100W PD Pass-Through', 'Gigabit Ethernet RJ45 Port', 'UHS-II SD/MicroSD Card Slots', 'Braided Cable with Braided Strain Relief'],
    tags: ['hub', 'usb-c', 'dock', 'monitors'],
    description: 'Connect dual monitors, flash drives, Ethernet, and audio through a single USB-C cord on MacBook or Windows laptops.'
  },
  {
    title: 'Apex 360 Action Camera 5.3K 60fps Waterproof',
    category: 'Electronics & Gadgets',
    brand: 'AeroTech',
    price: 369.99,
    original_price: 429.99,
    rating: 4.7,
    reviews_count: 112,
    stock: 19,
    badge: 'Best Seller',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1500634245200-e5245c7574ef?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1500634245200-e5245c7574ef?w=800&q=80'],
    features: ['5.3K 60fps & 4K 120fps Slow-Mo', 'HyperSteady Horizon Leveling', 'Waterproof to 33ft without case', 'Dual Color Touchscreens', 'Voice Control in 10 Languages'],
    tags: ['action-cam', 'waterproof', 'camera', 'sports'],
    description: 'Built for adrenaline junkies. Rock-solid stabilization keeps horizon level even through flips, rolls, and rapid downhill descents.'
  },
  {
    title: 'Velo Wireless Smart Bike Computer & Light',
    category: 'Electronics & Gadgets',
    brand: 'TitanWear',
    price: 89.99,
    original_price: 109.99,
    rating: 4.5,
    reviews_count: 73,
    stock: 28,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80'],
    features: ['Turn-by-turn Offline GPS Routing', '800-Lumen Smart Adaptive Headlight', 'Cadence & Heart-Rate Sensor Sync', 'Strava Direct Upload', 'IPX7 Weatherproof Casing'],
    tags: ['bike', 'cycling', 'gps', 'outdoors'],
    description: 'High-contrast sunlight-readable screen tracks speed, distance, elevation, and automatically brightens headlamp in tunnels and dusk.'
  },
  {
    title: 'Aura Thermal Imaging Smartphone Camera Plug',
    category: 'Electronics & Gadgets',
    brand: 'OptiPix',
    price: 249.99,
    original_price: 299.99,
    rating: 4.6,
    reviews_count: 53,
    stock: 11,
    badge: 'Pro Pick',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80'],
    features: ['-20°C to 400°C Temperature Range', 'High-Res FLIR Lepton Microbolometer', 'Dual MSX Image Blending', 'USB-C Plug for iOS and Android', 'Inspection Report Generator App'],
    tags: ['thermal', 'camera', 'diy', 'inspection'],
    description: 'Find insulation leaks, electrical hot-spots, and plumbing issues instantly with military-grade thermal infrared imaging.'
  },
  {
    title: 'SonicClean UV Smartphone & Gear Sanitizer',
    category: 'Electronics & Gadgets',
    brand: 'NovaVolt',
    price: 39.99,
    original_price: 49.99,
    rating: 4.3,
    reviews_count: 140,
    stock: 40,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80'],
    features: ['360° Hospital-Grade UV-C LEDs', '99.99% Bacteria Kill in 3 Minutes', 'Built-in 10W Wireless Charger on Lid', 'Aromatherapy Diffuser Chamber', 'Fits iPhone Pro Max & Glasses'],
    tags: ['sanitizer', 'uv', 'clean', 'hygiene'],
    description: 'Sanitize your daily carry items while charging your phone. Clean watch straps, keys, earbuds, and smartphones without liquids or harsh chemicals.'
  },
  {
    title: 'OmniFold Flexible Solar Panel 60W',
    category: 'Electronics & Gadgets',
    brand: 'AeroTech',
    price: 119.00,
    original_price: 149.00,
    rating: 4.8,
    reviews_count: 67,
    stock: 16,
    badge: 'Staff Pick',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&q=80'],
    features: ['Monocrystalline 24% Efficiency Cells', 'Folds into Compact Briefcase Size', 'Dual QC3.0 USB & DC Barrel Out', 'Durable ETFE Water-Resistant Coating', 'Built-in Kickstand for Angle Tuning'],
    tags: ['solar', 'camping', 'green-energy', 'outdoor'],
    description: 'Generate free green power wherever your adventures take you. Ideal for campervans, tents, emergency kits, and off-grid workstations.'
  },
  {
    title: 'KeyGuard Fingerprint Smart Padlock',
    category: 'Electronics & Gadgets',
    brand: 'TitanWear',
    price: 34.99,
    original_price: 45.00,
    rating: 4.4,
    reviews_count: 98,
    stock: 52,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80'],
    features: ['0.2s Biometric Instant Unlock', 'Stores 20 Distinct Fingerprints', 'Cut-Resistant Zinc Alloy Shackle', 'IP65 Dust & Rain Waterproof', '1-Year Standby on Single Charge'],
    tags: ['security', 'lock', 'fingerprint', 'gym'],
    description: 'No keys to lose and no dials to remember. Unlock your gym locker, travel luggage, or storage shed with a light touch of your fingertip.'
  },

  // 16-25: Audio & Sound
  {
    title: 'SonicWave Studio Pro ANC Wireless Headphones',
    category: 'Audio & Sound',
    brand: 'SonicWave',
    price: 279.99,
    original_price: 349.99,
    rating: 4.9,
    reviews_count: 480,
    stock: 25,
    badge: 'Best Seller',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80'
    ],
    features: ['Hybrid Active Noise Cancelling (45dB)', 'Custom 40mm Beryllium Drivers', '60-Hour Long Battery Playtime', 'Plush Memory Foam Protein Leather', 'Hi-Res LDAC & AAC Audio Codecs'],
    tags: ['headphones', 'anc', 'wireless', 'music', 'audiophile'],
    description: 'Immerse yourself in concert-hall sound quality. Advanced active noise cancellation silences engine roar and office chatter with crystal-clear vocal reproduction.'
  },
  {
    title: 'AcousticAir True Wireless Earbuds with Spatial Audio',
    category: 'Audio & Sound',
    brand: 'SonicWave',
    price: 129.99,
    original_price: 159.99,
    rating: 4.8,
    reviews_count: 360,
    stock: 42,
    badge: 'Popular',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&q=80',
      'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&q=80'
    ],
    features: ['Dynamic Head-Tracking 3D Spatial Audio', 'Transparency Mode for Ambient Clarity', 'IPX7 Sweatproof & Waterproof', '36 Hours Total Battery with Case', 'Qi Wireless Fast Charging Case'],
    tags: ['earbuds', 'wireless', 'bluetooth', 'gym'],
    description: 'Ergonomically tuned earbuds that stay locked into your ears during high-intensity workouts. Deep sub-bass and ultra-low latency gaming mode.'
  },
  {
    title: 'RetroCraft Walnut Turntable with Bluetooth Out',
    category: 'Audio & Sound',
    brand: 'AcousticWood',
    price: 189.00,
    original_price: 229.00,
    rating: 4.7,
    reviews_count: 89,
    stock: 12,
    badge: 'Staff Pick',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80'],
    features: ['Audio-Technica Magnetic Cartridge', 'Solid Walnut Plinth Vibration Damping', 'Belt-Driven 33 1/3 & 45 RPM Speeds', 'Bluetooth 5.3 Transmitter & RCA Line', 'Aluminum Die-Cast Platter'],
    tags: ['vinyl', 'turntable', 'record-player', 'vintage'],
    description: 'Enjoy warm, analog vinyl sound with modern convenience. Stream vinyl records wirelessly to your Bluetooth speakers or plug into your Hi-Fi amp.'
  },
  {
    title: 'SoundSphere 360° Waterproof Bluetooth Speaker',
    category: 'Audio & Sound',
    brand: 'SonicWave',
    price: 79.99,
    original_price: 99.99,
    rating: 4.6,
    reviews_count: 240,
    stock: 30,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80'],
    features: ['Room-Filling 360-Degree Sound', 'IP67 Dust & Floating Waterproof', '24-Hour Battery with Power Bank Out', 'PartySync Link 100+ Speakers', 'Tough Rugged Drop-Proof Shell'],
    tags: ['speaker', 'bluetooth', 'waterproof', 'outdoor'],
    description: 'Pump crisp, punchy audio at the pool, beach, or campfire. Floats on water and doubles as a phone charger in emergencies.'
  },
  {
    title: 'VocalPro USB Studio Condenser Microphone',
    category: 'Audio & Sound',
    brand: 'StudioGrade',
    price: 99.00,
    original_price: 120.00,
    rating: 4.7,
    reviews_count: 175,
    stock: 20,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&q=80'],
    features: ['24-bit/192kHz Studio Recording Grade', 'Cardioid, Omni, & Bi-Directional Modes', 'Zero-Latency Headphone Monitoring', 'Integrated Pop Filter & Shock Mount', 'Tap-to-Mute Sensor with RGB LED'],
    tags: ['microphone', 'podcast', 'streaming', 'audio'],
    description: 'Broadcast-quality voice clarity for streaming, podcasting, ASMR, and zoom calls. Plug and play simplicity with no external interface required.'
  },
  {
    title: 'CinemaBar Dolby Atmos TV Soundbar & Wireless Sub',
    category: 'Audio & Sound',
    brand: 'SonicWave',
    price: 349.99,
    original_price: 429.99,
    rating: 4.8,
    reviews_count: 92,
    stock: 10,
    badge: 'Hot Deal',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80'],
    features: ['5.1.2 Channel Immersive Dolby Atmos', 'Up-Firing Spatial Ceiling Drivers', '8-inch Wireless Deep Bass Subwoofer', 'eARC HDMI 4K Pass-Through', 'Night Mode Dialogue Enhancer'],
    tags: ['soundbar', 'home-theater', 'dolby-atmos', 'tv'],
    description: 'Transform movies and video games with multi-dimensional audio that moves overhead and around you. Crisp dialogue even at low volumes.'
  },
  {
    title: 'EarShield Musician High-Fidelity Earplugs (2-Pack)',
    category: 'Audio & Sound',
    brand: 'StudioGrade',
    price: 24.99,
    original_price: 32.00,
    rating: 4.6,
    reviews_count: 154,
    stock: 55,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'],
    features: ['Flat 21dB Attenuation Acoustic Filter', 'Preserves Musical Balance & Clarity', 'Medical Grade Hypoallergenic Silicone', 'Aluminum Keychain Carry Capsule', 'Two Interlocking Flange Sizes'],
    tags: ['earplugs', 'concerts', 'hearing', 'protection'],
    description: 'Protect your hearing at concerts, clubs, and festivals without muffling the sound. Even acoustic damping maintains full musical fidelity.'
  },
  {
    title: 'BassForge Desktop Reference Monitors (Pair)',
    category: 'Audio & Sound',
    brand: 'StudioGrade',
    price: 149.99,
    original_price: 189.99,
    rating: 4.7,
    reviews_count: 64,
    stock: 14,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&q=80'],
    features: ['4-inch Woven Kevlar Woofers', '1-inch Silk Dome Tweeters', 'Acoustic Space EQ Room Tuning', 'Balanced TRS & RCA Inputs', 'Front Headphone & AUX Jack'],
    tags: ['monitors', 'speakers', 'desktop', 'music-production'],
    description: 'Engineered for audio mixing, mastering, and critical listening. Accurate flat response reveals subtle details in recordings and video edits.'
  },
  {
    title: 'OpenEar Bone Conduction Sport Headset',
    category: 'Audio & Sound',
    brand: 'SonicWave',
    price: 89.99,
    original_price: 119.99,
    rating: 4.5,
    reviews_count: 128,
    stock: 22,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&q=80'],
    features: ['Bone Conduction Open-Ear Safety', 'Lightweight 29g Titanium Frame', '10-Hour Continuous Playback', 'IP67 Sweat & Weather Resistant', 'Dual Noise-Canceling Call Mics'],
    tags: ['bone-conduction', 'running', 'sports', 'cycling'],
    description: 'Listen to motivating tunes while remaining completely aware of traffic and ambient sounds during outdoor runs and rides.'
  },
  {
    title: 'AuraSound Tube Pre-Amplifier Headphone Amp',
    category: 'Audio & Sound',
    brand: 'AcousticWood',
    price: 119.00,
    original_price: 145.00,
    rating: 4.8,
    reviews_count: 51,
    stock: 9,
    badge: 'Limited',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1539185441755-769473a23570?w=800&q=80'],
    features: ['Dual 6J1 Vacuum Tubes', 'Pure Class A Amplification', 'Drives High-Impedance 600Ω Cans', 'Solid CNC Machined Chassis', 'Bass & Treble Analog Knobs'],
    tags: ['amp', 'tube-amp', 'audiophile', 'hi-fi'],
    description: 'Infuse your digital music library with lush vacuum tube warmth, creamy harmonics, and expansive staging.'
  },

  // 26-37: Computers & Office
  {
    title: 'KeyChron MechPro Wireless Mechanical Keyboard',
    category: 'Computers & Office',
    brand: 'KeyChron',
    price: 109.99,
    original_price: 139.99,
    rating: 4.9,
    reviews_count: 310,
    stock: 35,
    badge: 'Best Seller',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&q=80'
    ],
    features: ['Hot-Swappable Gateron Pro Switches', 'QMK/VIA Fully Programmable', 'Mac & Windows Keycap Layouts', 'Solid CNC Anodized Aluminum Case', 'RGB Backlight with 22 Animation Modes'],
    tags: ['keyboard', 'mechanical', 'wireless', 'office', 'gaming'],
    description: 'The pinnacle of tactile typing satisfaction. Connect seamlessly to three devices via Bluetooth 5.1 or lag-free wired USB-C.'
  },
  {
    title: 'ErgoMaster High-Back Mesh Executive Chair',
    category: 'Computers & Office',
    brand: 'ErgoForm',
    price: 329.00,
    original_price: 399.00,
    rating: 4.8,
    reviews_count: 165,
    stock: 12,
    badge: 'Staff Pick',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1580481077195-c3a82145beee?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1580481077195-c3a82145beee?w=800&q=80'],
    features: ['Dynamic Self-Adjusting Lumbar Support', '4D Adjustable Armrests', 'Breathable Cool-Flow Korean Mesh', '135° Recline with Multi-Angle Lock', 'Heavy-Duty Class 4 Gas Cylinder'],
    tags: ['chair', 'ergonomic', 'office', 'furniture'],
    description: 'Eliminate lower back strain during long work hours. Responsive ergonomic contours support spine alignment automatically.'
  },
  {
    title: 'UltraVision 27-inch 4K IPS Creator Monitor',
    category: 'Computers & Office',
    brand: 'OptiPix',
    price: 449.00,
    original_price: 529.00,
    rating: 4.8,
    reviews_count: 142,
    stock: 15,
    badge: 'Pro Pick',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80'],
    features: ['3840 x 2160 UHD Factory Calibrated', '99% DCI-P3 & 100% sRGB Color Space', '90W USB-C Single Cable Charging', 'Ergonomic Height, Pivot & Tilt Stand', 'TUV Rheinland Low Blue Light Certified'],
    tags: ['monitor', '4k', 'display', 'creator'],
    description: 'Pixel-perfect color reproduction for video editors, graphic designers, and photographers. Power your laptop and display video over one USB-C cable.'
  },
  {
    title: 'GlideMaster Ergonomic Vertical Wireless Mouse',
    category: 'Computers & Office',
    brand: 'ErgoForm',
    price: 49.99,
    original_price: 65.00,
    rating: 4.6,
    reviews_count: 220,
    stock: 45,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80'],
    features: ['57° Natural Handshake Grip Angle', 'Whisper-Quiet Click Switches', 'Adjustable 4000 DPI Optical Sensor', 'Thumb Scroll Wheel & Gesture Buttons', 'Rechargeable 4-Month Battery'],
    tags: ['mouse', 'ergonomic', 'wireless', 'office'],
    description: 'Reduce muscle strain and wrist compression by up to 20%. Natural vertical posture feels like a handshake for all-day comfort.'
  },
  {
    title: 'AuraLight Smart Screenbar Monitor Light Bar',
    category: 'Computers & Office',
    brand: 'AeroTech',
    price: 59.99,
    original_price: 79.99,
    rating: 4.7,
    reviews_count: 195,
    stock: 38,
    badge: 'Trending',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'],
    features: ['Asymmetric Optical Design (Zero Glare)', 'Wireless Desktop Dial Controller', 'Adjustable Color Temp 2700K - 6500K', 'Auto-Dimming Ambient Light Sensor', 'Saves 100% of Desk Surface Space'],
    tags: ['light-bar', 'desk-setup', 'lighting', 'workspace'],
    description: 'Illuminate your workspace without screen glare or eye fatigue. Weighted clip sits safely on flat or curved monitors.'
  },
  {
    title: 'Zenith Solid Oak Electric Standing Desk 60x30',
    category: 'Computers & Office',
    brand: 'ErgoForm',
    price: 499.00,
    original_price: 599.00,
    rating: 4.9,
    reviews_count: 87,
    stock: 8,
    badge: 'Top Rated',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=800&q=80'],
    features: ['Dual High-Torque Whisper Motors (<45dB)', '4-Preset Digital Memory Keypad', 'Anti-Collision Sensor Technology', 'Solid European White Oak Surface', 'Supports up to 275 lbs Load'],
    tags: ['desk', 'standing-desk', 'furniture', 'ergonomic'],
    description: 'Transition smoothly from sitting to standing in seconds. Hand-finished real oak tabletop with integrated wire management tray.'
  },
  {
    title: 'LeatherCraft Vegan Desk Mat 36x18 with Stitching',
    category: 'Computers & Office',
    brand: 'LeatherCraft',
    price: 29.99,
    original_price: 39.99,
    rating: 4.6,
    reviews_count: 180,
    stock: 50,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80'],
    features: ['Water-Resistant & Easy Clean Surface', 'Non-Slip Suede Base', 'Precision Peripheral Edge Stitching', 'Smooth Mouse Gliding Action', 'Protects Desks from Scratches & Spills'],
    tags: ['desk-mat', 'mousepad', 'workspace', 'leather'],
    description: 'Elevate your desk aesthetics with waterproof textured leatherette. Provides soft cushioning for elbows and precision tracking for optical mice.'
  },
  {
    title: 'ClearCall 4K AI Auto-Framing Web Camera',
    category: 'Computers & Office',
    brand: 'OptiPix',
    price: 119.99,
    original_price: 149.99,
    rating: 4.6,
    reviews_count: 133,
    stock: 24,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80'],
    features: ['Sony STARVIS 4K Sensor', 'AI Facial Tracking & Auto-Framing', 'Dual Omnidirectional Noise-Canceling Mics', 'Magnetic Privacy Shutter Cap', 'HDR Low-Light Auto Adjustment'],
    tags: ['webcam', '4k', 'streaming', 'zoom'],
    description: 'Look your best on every executive presentation and team meeting. Automatically keeps you in frame even when you shift posture.'
  },
  {
    title: 'ArcFold Aluminum Laptop Stand Adjustable',
    category: 'Computers & Office',
    brand: 'ErgoForm',
    price: 38.99,
    original_price: 49.99,
    rating: 4.7,
    reviews_count: 260,
    stock: 55,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80'],
    features: ['Raises Screen up to 7.8 inches', 'Sandblasted Anodized Aluminum', 'Open Airflow Cooling Cutouts', 'Silicone Anti-Scratch Pads', 'Folds Flat for Commuter Backpacks'],
    tags: ['laptop-stand', 'aluminum', 'ergonomic', 'accessories'],
    description: 'Align your laptop screen with your eye line to alleviate neck and shoulder fatigue. Rigid dual-pivot joints support up to 17-inch laptops.'
  },
  {
    title: 'VaultSafe 2TB Rugged External NVMe SSD',
    category: 'Computers & Office',
    brand: 'NovaVolt',
    price: 169.99,
    original_price: 219.99,
    rating: 4.9,
    reviews_count: 145,
    stock: 20,
    badge: 'Hot Deal',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80'],
    features: ['Blistering 2000MB/s Read & Write', 'USB 3.2 Gen 2x2 Type-C', 'IP65 Dust/Water & 3-Meter Drop Proof', 'Hardware 256-Bit AES Encryption', 'Compact Pocket Form Factor'],
    tags: ['ssd', 'storage', 'backup', 'nvme'],
    description: 'Transfer 50GB of 4K video files in under 30 seconds. Silicone bumper protects against heavy drops and rugged conditions.'
  },
  {
    title: 'QuietClick Number Pad Wireless Bluetooth',
    category: 'Computers & Office',
    brand: 'KeyChron',
    price: 32.99,
    original_price: 42.00,
    rating: 4.4,
    reviews_count: 88,
    stock: 30,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&q=80'],
    features: ['Scissor-Switch Silent Keys', 'Ergonomic 15° Slant', 'Rechargeable via Type-C', 'Instant Calculation Key Shortcut', 'Aluminum Alloy Base Plate'],
    tags: ['numpad', 'keyboard', 'accounting', 'office'],
    description: 'Ideal companion for accountants, analysts, and spreadsheets. Compact companion for tenkeyless keyboards.'
  },
  {
    title: 'CableNest Weighted Magnetic Cable Organizer',
    category: 'Computers & Office',
    brand: 'LeatherCraft',
    price: 19.99,
    original_price: 24.99,
    rating: 4.5,
    reviews_count: 110,
    stock: 70,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=800&q=80'],
    features: ['5 Magnetic Cable Snaps Included', 'Weighted Iron Core Won\'t Tip Over', 'Nano-Suction Base Washable Adhesive', 'Accommodates USB-C, Lightning, HDMI', 'Sleek Minimal Matte Black Finish'],
    tags: ['cable-management', 'organization', 'desk', 'minimal'],
    description: 'Keep your charging cords anchored and accessible at your fingertips instead of sliding behind your desk.'
  },

  // 38-52: Fashion & Apparel
  {
    title: 'NorthPeak Weatherproof Technical Bomber Jacket',
    category: 'Fashion & Apparel',
    brand: 'NorthPeak',
    price: 149.00,
    original_price: 189.00,
    rating: 4.8,
    reviews_count: 198,
    stock: 20,
    badge: 'Best Seller',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&q=80'
    ],
    features: ['DWR Water-Repellent Nano Shell', 'Windproof Thermal Microfleece Lining', 'YKK Aquaguard Waterproof Zippers', 'Concealed Interior Passport Pockets', 'Ribbed Elastic Hem & Cuffs'],
    tags: ['jacket', 'outerwear', 'menswear', 'streetwear'],
    description: 'A stylish blend of modern streetwear and mountain-tested utility. Repels torrential downpours while keeping you comfortably insulated.'
  },
  {
    title: 'UrbanStride Minimalist Leather Sneakers',
    category: 'Fashion & Apparel',
    brand: 'UrbanStride',
    price: 129.99,
    original_price: 160.00,
    rating: 4.7,
    reviews_count: 245,
    stock: 28,
    badge: 'Popular',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80',
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800&q=80'
    ],
    features: ['Full-Grain Italian Calfskin Leather', 'Cushioned Memory Foam Insole', 'Margom Stitched Rubber Cupsole', 'Waxed Cotton Flat Laces', 'Breathable Leather Lining'],
    tags: ['sneakers', 'shoes', 'footwear', 'minimal'],
    description: 'Clean, versatile, and exquisitely handcrafted. Dresses up effortlessly with chinos or down with dark denim jeans.'
  },
  {
    title: 'AuraCraft Cashmere Blend Crewneck Sweater',
    category: 'Fashion & Apparel',
    brand: 'AuraCraft',
    price: 98.00,
    original_price: 135.00,
    rating: 4.8,
    reviews_count: 112,
    stock: 16,
    badge: 'Staff Pick',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80'],
    features: ['Grade-A Mongolian Cashmere & Merino', 'Ultra-Soft 12-Gauge Knit', 'Anti-Pilling Durable Fiber Weave', 'Tailored Modern Fit', 'Naturally Temperature Regulating'],
    tags: ['sweater', 'cashmere', 'knitwear', 'luxury'],
    description: 'Unrivaled cloud-like softness against bare skin. Breathable natural fibers keep you cozy through autumn chills and winter freezes.'
  },
  {
    title: 'Heritage Bifold RFID Leather Wallet',
    category: 'Fashion & Apparel',
    brand: 'LeatherCraft',
    price: 45.00,
    original_price: 60.00,
    rating: 4.9,
    reviews_count: 380,
    stock: 65,
    badge: 'Best Seller',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&q=80'],
    features: ['Vegetable-Tanned Crazy Horse Leather', 'Certified RFID Signal Blocking Mesh', 'Holds 8-12 Cards & Flat Cash Billfold', 'Quick-Access Thumb Slide Slot', 'Develops Rich Patina with Age'],
    tags: ['wallet', 'leather', 'accessories', 'edc'],
    description: 'Slim silhouette engineered to eliminate pocket bulk while protecting credit cards from wireless skimming.'
  },
  {
    title: 'Solaris Polarized Aviator Sunglasses Titanium',
    category: 'Fashion & Apparel',
    brand: 'OptiPix',
    price: 89.99,
    original_price: 119.99,
    rating: 4.6,
    reviews_count: 140,
    stock: 30,
    badge: 'Trending',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80'],
    features: ['100% UV400 Glare-Eliminating Lenses', 'Aerospace Grade Titanium Wire Frame', 'Self-Adjusting Silicone Nose Pads', 'Scratch & Saltwater Resistant Coating', 'Hard Clamshell Travel Case Included'],
    tags: ['sunglasses', 'eyewear', 'summer', 'accessories'],
    description: 'Featherlight frames you can wear all day without temple pinch. High-contrast tint sharpens scenic road trips and boat outings.'
  },
  {
    title: 'Kuro Raw Selvedge Denim Slim Straight Jeans',
    category: 'Fashion & Apparel',
    brand: 'UrbanStride',
    price: 110.00,
    original_price: 145.00,
    rating: 4.7,
    reviews_count: 90,
    stock: 22,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&q=80'],
    features: ['13.5oz Kuroki Mills Japanese Selvedge', 'Red-Line Selvedge ID Seam', 'Custom Copper Rivets & Button Fly', 'Chainstitched Hem detailing', 'Molds to Your Unique Wear Patterns'],
    tags: ['jeans', 'denim', 'selvedge', 'menswear'],
    description: 'Authentic shuttle-loom woven denim from Okayama. Unwashed indigo yields unique personalized fades the more you wear them.'
  },
  {
    title: 'Merino Wool Daily Cushion Crew Socks (3-Pack)',
    category: 'Fashion & Apparel',
    brand: 'NorthPeak',
    price: 28.00,
    original_price: 36.00,
    rating: 4.9,
    reviews_count: 290,
    stock: 80,
    badge: 'Top Rated',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1582966772680-860e372bb558?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1582966772680-860e372bb558?w=800&q=80'],
    features: ['Fine Merino Wool Natural Odor Control', 'Seamless Reinforced Toe & Heel Box', 'Targeted Arch Compression Band', 'High-Density Terrys Cushion Footbed', 'Blister-Free Guarantee'],
    tags: ['socks', 'merino', 'comfort', 'apparel'],
    description: 'The last pair of socks you will ever want to wear. Wick moisture away during long commutes or rocky weekend trails.'
  },
  {
    title: 'Drift Canvas Weekend Duffle Bag 40L',
    category: 'Fashion & Apparel',
    brand: 'LeatherCraft',
    price: 85.00,
    original_price: 110.00,
    rating: 4.8,
    reviews_count: 175,
    stock: 19,
    badge: 'Staff Pick',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'],
    features: ['16oz Heavy Waxed Duck Canvas', 'Genuine Full-Grain Leather Straps', 'Dedicated Ventilated Shoe Compartment', 'TSA Overhead Carry-On Compliant', 'Brass Hardware & Reinforced Base Studs'],
    tags: ['bag', 'duffle', 'travel', 'luggage'],
    description: 'Sized perfectly for weekend getaways and gym visits. Dedicated shoe tunnel keeps clean clothes separate from footwear.'
  },
  {
    title: 'AuraCraft Organic Heavyweight T-Shirt (3-Pack)',
    category: 'Fashion & Apparel',
    brand: 'AuraCraft',
    price: 49.99,
    original_price: 65.00,
    rating: 4.7,
    reviews_count: 310,
    stock: 50,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'],
    features: ['240 GSM 100% GOTS Certified Cotton', 'Pre-Shrunk Structured Boxy Fit', 'Durable 1-inch Ribbed Collar', 'Clean Blind-Stitched Hemlines', 'Available in White, Black, and Heather Grey'],
    tags: ['tshirt', 'basics', 'cotton', 'apparel'],
    description: 'Substantial, thick cotton tees that never feel flimsy or see-through. Retains shape after dozens of machine washes.'
  },
  {
    title: 'TitanSteel Diver Chronograph Watch 200M',
    category: 'Fashion & Apparel',
    brand: 'TitanWear',
    price: 249.00,
    original_price: 320.00,
    rating: 4.8,
    reviews_count: 84,
    stock: 14,
    badge: 'Hot Deal',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80'],
    features: ['Japanese Seiko Mecha-Quartz Movement', 'Scratchproof Anti-Reflective Sapphire', 'Ceramic 120-Click Unidirectional Bezel', 'Super-LumiNova BGW9 Glowing Dial', 'Solid 316L Stainless Steel Bracelet'],
    tags: ['watch', 'chronograph', 'diver', 'luxury'],
    description: 'Combines mechanical chronograph feel with quartz grab-and-go precision. Certified 200-meter water resistance with screw-down crown.'
  },
  {
    title: 'TerraFlex Waterproof Trail Running Shoes',
    category: 'Fashion & Apparel',
    brand: 'NorthPeak',
    price: 139.99,
    original_price: 169.99,
    rating: 4.6,
    reviews_count: 105,
    stock: 25,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80'],
    features: ['Gore-Tex Invisible Fit Waterproofing', 'Vibram Megagrip 5mm Deep Lugs', 'Responsive Nitrogen-Infused Foam', 'Reinforced Rock Protection Plate', 'Quick-Lace Drawcord System'],
    tags: ['trail-running', 'shoes', 'waterproof', 'hiking'],
    description: 'Tackle muddy trails, wet rocks, and steep inclines with unshakable traction and dry feet.'
  },
  {
    title: 'AuraSilk Mulberry Silk Sleep Eye Mask',
    category: 'Fashion & Apparel',
    brand: 'AuraCraft',
    price: 24.99,
    original_price: 32.00,
    rating: 4.8,
    reviews_count: 220,
    stock: 60,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80'],
    features: ['100% 22-Momme Grade 6A Pure Silk', 'Complete 100% Light Blackout Design', 'Pain-Free Elasticated Silk Headband', 'Gentle on Eyelashes and Delicate Skin', 'Includes Breathable Travel Pouch'],
    tags: ['sleep', 'silk', 'wellness', 'travel'],
    description: 'Experience deeper REM sleep anywhere. Silk protein fibers hydrate skin around eyes and prevent sleep wrinkles.'
  },
  {
    title: 'Nordic Knit Chunky Ribbed Beanie',
    category: 'Fashion & Apparel',
    brand: 'NorthPeak',
    price: 22.99,
    original_price: 30.00,
    rating: 4.7,
    reviews_count: 145,
    stock: 45,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&q=80'],
    features: ['100% Non-Scratch Merino Wool', 'Double-Cuff Ear Warming Band', 'Snug Elastic Ribbed Knit', 'Available in Forest Green & Charcoal', 'Packable in Any Coat Pocket'],
    tags: ['beanie', 'winter', 'hat', 'accessories'],
    description: 'Timeless fisherman beanie silhouette that traps body heat without causing an itchy scalp.'
  },
  {
    title: 'Solstice Woven Italian Suede Belt 35mm',
    category: 'Fashion & Apparel',
    brand: 'LeatherCraft',
    price: 39.99,
    original_price: 55.00,
    rating: 4.5,
    reviews_count: 76,
    stock: 35,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&q=80'],
    features: ['Hand-Braided Elastic Italian Suede', 'Solid Brushed Nickel Buckle', 'No Pre-Punched Holes for Micro-Fit', 'Durable Leather End Trim', 'Stretches with Daily Movement'],
    tags: ['belt', 'suede', 'accessories', 'style'],
    description: 'The buckle pin slides between braids at any point for an exact custom waistline fit every day.'
  },
  {
    title: 'AuraCloud Modal Lounge Jogger Pants',
    category: 'Fashion & Apparel',
    brand: 'AuraCraft',
    price: 54.00,
    original_price: 70.00,
    rating: 4.8,
    reviews_count: 160,
    stock: 32,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&q=80'],
    features: ['Buttery Micro-Modal & Elastane Blend', 'Zippered Deep Phone Pockets', 'Tapered Ankle Ribbed Cuffs', 'Encased Elastic Drawstring Waist', 'Breathable Anti-Static Finish'],
    tags: ['joggers', 'loungewear', 'pants', 'comfort'],
    description: 'Designed for working from home, weekend lounging, or post-workout recovery. Incredibly soft with a streamlined silhouette.'
  },

  // 53-67: Home & Kitchen
  {
    title: 'BaristaPro Precision Espresso Machine with Grinder',
    category: 'Home & Kitchen',
    brand: 'CaffeMaster',
    price: 649.00,
    original_price: 799.00,
    rating: 4.9,
    reviews_count: 275,
    stock: 10,
    badge: 'Best Seller',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&q=80',
      'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=800&q=80'
    ],
    features: ['15-Bar Italian Vibration Pump', 'Integrated Conical Burr Grinder with 30 Settings', 'PID Digital Temperature Control (±1°C)', 'Powerful Commercial Micro-Foam Steam Wand', '54mm Stainless Steel Portafilter'],
    tags: ['coffee', 'espresso', 'kitchen', 'appliances'],
    description: 'Create cafe-quality micro-foam lattes and rich golden crema espressos from whole beans to cup in under a minute.'
  },
  {
    title: 'CrispAir Turbo Vortex 6-Quart Digital Air Fryer',
    category: 'Home & Kitchen',
    brand: 'ChefLine',
    price: 89.99,
    original_price: 119.99,
    rating: 4.8,
    reviews_count: 410,
    stock: 35,
    badge: 'Popular',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80'],
    features: ['360° Rapid Cyclonic Air Circulation', '8 One-Touch Smart Cooking Presets', 'Nonstick Ceramic Basket PFOA/PTFE Free', 'Dishwasher Safe Easy Clean Tray', 'Uses up to 85% Less Oil than Deep Frying'],
    tags: ['airfryer', 'kitchen', 'cooking', 'healthy'],
    description: 'Get extra-crispy chicken wings, golden fries, and roasted veggies fast with minimal oil and virtually zero preheat time.'
  },
  {
    title: 'IronForge 12-inch Pre-Seasoned Cast Iron Skillet',
    category: 'Home & Kitchen',
    brand: 'IronForge',
    price: 39.99,
    original_price: 52.00,
    rating: 4.9,
    reviews_count: 520,
    stock: 50,
    badge: 'Top Rated',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80'],
    features: ['Triple Seasoned with 100% Flaxseed Oil', 'Even Heat Retention & High Searing Temp', 'Stovetop, Oven, Grill & Campfire Safe', 'Dual Pour Spouts for Grease Control', 'Ergonomic Assist Handle'],
    tags: ['skillet', 'cookware', 'cast-iron', 'chef'],
    description: 'A kitchen heirloom that lasts generations. Sears steaks with restaurant crusts and bakes golden cornbread.'
  },
  {
    title: 'Santoku Damascus 8-inch Japanese Chef Knife',
    category: 'Home & Kitchen',
    brand: 'ChefLine',
    price: 79.99,
    original_price: 110.00,
    rating: 4.8,
    reviews_count: 185,
    stock: 22,
    badge: 'Pro Pick',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1593618998160-e34014e67546?w=800&q=80'],
    features: ['67-Layer VG-10 Core Damascus Steel', 'Razor Sharp 15-Degree Hand-Honed Edge', 'Military Grade G10 Ergonomic Handle', 'Full Tang Balance & Rocking Curvature', 'Custom Wooden Saya Sheath Included'],
    tags: ['knife', 'cutlery', 'damascus', 'chef'],
    description: 'Glides effortlessly through tender meats, fibrous vegetables, and ripe tomatoes with surgical precision.'
  },
  {
    title: 'AuraBrew Electric Gooseneck Pour-Over Kettle',
    category: 'Home & Kitchen',
    brand: 'CaffeMaster',
    price: 69.99,
    original_price: 89.99,
    rating: 4.7,
    reviews_count: 215,
    stock: 28,
    badge: 'Trending',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80'],
    features: ['Precision 1°F Dial Temperature Control', 'Elongated Gooseneck for Optimal Water Flow', 'Built-in Brew Stopwatch Timer', 'Food Grade 304 Stainless Steel Interior', '60-Minute Temperature Hold Mode'],
    tags: ['kettle', 'coffee', 'pour-over', 'tea'],
    description: 'Target exact temperatures for delicate green teas or specialty pour-overs with laminar spill-free flow control.'
  },
  {
    title: 'PureFlow 4-Stage Countertop Reverse Osmosis Filter',
    category: 'Home & Kitchen',
    brand: 'ChefLine',
    price: 199.99,
    original_price: 249.99,
    rating: 4.8,
    reviews_count: 94,
    stock: 14,
    badge: 'Staff Pick',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=800&q=80'],
    features: ['Zero Installation Plug-and-Play', 'Removes 99.9% of Lead, Microplastics & PFAS', 'Remineralization Alkaline pH Cartridge', 'TDS Real-Time Water Quality Display', '3-Second Instant Hot Water Dispenser'],
    tags: ['water-filter', 'health', 'kitchen', 'appliances'],
    description: 'Pure, crisp drinking water right on your countertop with no plumbing or under-sink drilling needed.'
  },
  {
    title: 'Artisan Acacia Wood Large End-Grain Cutting Board',
    category: 'Home & Kitchen',
    brand: 'IronForge',
    price: 49.99,
    original_price: 65.00,
    rating: 4.7,
    reviews_count: 140,
    stock: 35,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&q=80'],
    features: ['Self-Healing End-Grain Wood Construction', 'Deep Juice Groove Holds 3.5oz of Liquid', 'Recessed Finger Grip Side Handles', 'Reversible Chopping & Charcuterie Server', 'Non-Slip Silicone Foot Dampers'],
    tags: ['cutting-board', 'wood', 'kitchen', 'prep'],
    description: 'Gentle on knife edges and naturally antimicrobial. Heavyweight 1.5-inch thickness prevents warping over time.'
  },
  {
    title: 'SousVide Precision Immersion Circulator 1100W',
    category: 'Home & Kitchen',
    brand: 'ChefLine',
    price: 79.00,
    original_price: 99.00,
    rating: 4.6,
    reviews_count: 120,
    stock: 25,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80'],
    features: ['±0.1°C Accurate Water Temperature', 'WiFi App Monitoring & Recipe Presets', 'Brushless Motor Super-Quiet Operation', 'Adjustable Pot Clamp Fits Any Container', 'Touchscreen LED Digital Interface'],
    tags: ['sousvide', 'cooking', 'chef', 'kitchen'],
    description: 'Cook steaks edge-to-edge medium rare and juicy chicken breasts with zero risk of overcooking.'
  },
  {
    title: 'AeroWine Electric Wine Opener & Aerator Set',
    category: 'Home & Kitchen',
    brand: 'CaffeMaster',
    price: 34.99,
    original_price: 45.00,
    rating: 4.5,
    reviews_count: 165,
    stock: 45,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80'],
    features: ['Opens 80 Bottles on Single Charge', 'Automatic 6-Second Cork Extraction', 'One-Touch Electric Decanting Spout', 'Vacuum Stopper Keeps Wine Fresh 7 Days', 'Includes Foil Cutter Stand'],
    tags: ['wine', 'opener', 'entertaining', 'bar'],
    description: 'Effortlessly uncork and aerate reds and whites with sleek modern flair. Essential centerpiece for dinner parties.'
  },
  {
    title: 'CeramiCook Non-Stick 10-Piece Ceramic Cookware Set',
    category: 'Home & Kitchen',
    brand: 'ChefLine',
    price: 189.99,
    original_price: 249.99,
    rating: 4.8,
    reviews_count: 130,
    stock: 15,
    badge: 'Hot Deal',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80'],
    features: ['100% Free of PTFE, PFOA, Lead, and Cadmium', 'Heavy-Gauge Forged Aluminum Core', 'Stay-Cool Gold Electroplated Stainless Handles', 'Oven Safe up to 500°F (260°C)', 'Includes Pan Organizers & Canvas Lid Holder'],
    tags: ['pots', 'pans', 'cookware', 'non-toxic'],
    description: 'Slick ceramic surface requires minimal butter or oil. Gorgeous neutral cream finish elevates kitchen aesthetics.'
  },
  {
    title: 'SpiceMill Stainless Gravity Electric Grinders (Pair)',
    category: 'Home & Kitchen',
    brand: 'IronForge',
    price: 29.99,
    original_price: 39.99,
    rating: 4.4,
    reviews_count: 210,
    stock: 60,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=800&q=80'],
    features: ['Tilt to Activate Gravity Sensor', 'Adjustable Coarseness Ceramic Rotor', 'Bright Blue LED Lights Up Food', 'Rechargeable Type-C Base Station', 'Large Transparent Spice Chamber'],
    tags: ['pepper-grinder', 'spices', 'kitchen', 'gadget'],
    description: 'Grind Himalayan salt and peppercorns one-handed simply by tipping the grinder downward over your food.'
  },
  {
    title: 'ColdBrew 64oz Airtight Glass Pitcher Infuser',
    category: 'Home & Kitchen',
    brand: 'CaffeMaster',
    price: 26.99,
    original_price: 34.99,
    rating: 4.7,
    reviews_count: 190,
    stock: 40,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&q=80'],
    features: ['Thick Borosilicate Thermal Shock Glass', 'Laser-Etched 18/8 Stainless Mesh Filter', 'Silicone Leakproof Vacuum Seal Lid', 'Fits Seamlessly into Standard Fridge Doors', 'Smooth Non-Drip Pour Spout'],
    tags: ['coldbrew', 'coffee', 'pitcher', 'tea'],
    description: 'Brew smooth, low-acid cold brew concentrate that stays fresh in the refrigerator for up to 2 weeks.'
  },
  {
    title: 'ThermoMug 16oz Temperature Control Smart Mug',
    category: 'Home & Kitchen',
    brand: 'AeroTech',
    price: 99.00,
    original_price: 129.00,
    rating: 4.6,
    reviews_count: 115,
    stock: 18,
    badge: 'Trending',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&q=80'],
    features: ['Maintains Heat Between 120°F - 145°F', 'App Customization via Bluetooth', 'Coaster Charger Keeps Cup Warm All Day', 'Auto-Sleep Motion Sensor', 'Scratch-Resistant Ceramic Coating'],
    tags: ['smart-mug', 'coffee', 'gadgets', 'desk'],
    description: 'Never sip lukewarm coffee again. Keeps your brew at your customized exact drinking temperature.'
  },
  {
    title: 'AuraSeal Food Vacuum Sealer & Roll Cutter',
    category: 'Home & Kitchen',
    brand: 'ChefLine',
    price: 54.99,
    original_price: 69.99,
    rating: 4.5,
    reviews_count: 155,
    stock: 30,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80'],
    features: ['80kPa Heavy-Duty Suction Pump', 'Dry, Moist, & Marinade Sealing Modes', 'Built-in Bag Roll Storage & Slide Cutter', 'External Suction Hose for Jars & Wine', 'Prevents Freezer Burn & Spoils'],
    tags: ['vacuum-sealer', 'food-preservation', 'kitchen'],
    description: 'Keep steaks, fruits, and meal preps fresh up to 5x longer. Compact design stores upright in drawers.'
  },
  {
    title: 'BakeWell 3-Piece Non-Stick Textured Baking Sheets',
    category: 'Home & Kitchen',
    brand: 'IronForge',
    price: 36.99,
    original_price: 48.00,
    rating: 4.8,
    reviews_count: 240,
    stock: 45,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&q=80'],
    features: ['Diamond Textured Bottom for Airflow', 'Heavy Carbon Steel Won\'t Warp under Heat', 'Reinforced Rolled Rim Steel Wire', 'Effortless Food Release Coating', 'Quarter, Jelly-Roll, and Half-Sheet Sizes'],
    tags: ['bakeware', 'cookies', 'baking', 'sheet-pan'],
    description: 'Even heat conduction bakes cookies evenly without scorching underneath. Easy hand wash with soapy warm water.'
  },

  // 68-79: Health & Beauty
  {
    title: 'GlowRadiance 7-Color LED Phototherapy Face Mask',
    category: 'Health & Beauty',
    brand: 'DermaGlow',
    price: 159.00,
    original_price: 210.00,
    rating: 4.8,
    reviews_count: 175,
    stock: 18,
    badge: 'Best Seller',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80'],
    features: ['Clinically Proven Red, Blue, Near-Infrared Wavelengths', 'Stimulates Natural Collagen Synthesis', 'Clears Acne-Causing Bacteria', 'Soft Eye Protection Silicon Goggles', 'Rechargeable Wireless Controller'],
    tags: ['skincare', 'led-mask', 'anti-aging', 'beauty'],
    description: 'Dermatologist-grade light therapy right on your sofa. Tightens pores, improves skin elasticity, and diminishes fine lines.'
  },
  {
    title: 'SonicDent Pro Ultra Sonic Electric Toothbrush',
    category: 'Health & Beauty',
    brand: 'SonicDent',
    price: 69.99,
    original_price: 89.99,
    rating: 4.9,
    reviews_count: 380,
    stock: 40,
    badge: 'Popular',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1559591937-e10220263f35?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1559591937-e10220263f35?w=800&q=80'],
    features: ['48,000 Micro-Vibrations Per Minute', '5 Modes: Clean, White, Polish, Gum Care, Sensitive', 'Smart 2-Minute Quad-Pacer Timer', '100-Day Battery on Single USB Charge', 'Includes 8 DuPont Replacement Heads & Case'],
    tags: ['toothbrush', 'dental', 'hygiene', 'oral-care'],
    description: 'Removes up to 10x more plaque than manual toothbrushes. Travel case makes it ideal for vacations and business trips.'
  },
  {
    title: 'PureBotanicals Vitamin C + Hyaluronic Acid Serum 2oz',
    category: 'Health & Beauty',
    brand: 'DermaGlow',
    price: 32.00,
    original_price: 42.00,
    rating: 4.8,
    reviews_count: 450,
    stock: 65,
    badge: 'Top Rated',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80'],
    features: ['20% Active L-Ascorbic Acid + Ferulic Acid', 'Deep Hydration Triple Hyaluronic Complex', 'Fades Dark Spots & Hyperpigmentation', '100% Vegan & Cruelty-Free', 'Amber Glass Dropper UV Shield'],
    tags: ['serum', 'skincare', 'vitamin-c', 'anti-aging'],
    description: 'Brightens complexion and neutralizes environmental free radicals for radiant, dewy glass skin.'
  },
  {
    title: 'AuraSpa Ultrasonic Ceramic Essential Oil Diffuser',
    category: 'Health & Beauty',
    brand: 'AuraCraft',
    price: 44.99,
    original_price: 58.00,
    rating: 4.7,
    reviews_count: 190,
    stock: 35,
    badge: 'Staff Pick',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&q=80'],
    features: ['Handcrafted Matte Ceramic Cover', 'Whisper-Quiet Ultrasonic Cool Mist', 'Warm Ambient Glow Candlelight Mode', 'Auto Shut-Off Waterless Protection', 'Covers up to 450 sq ft for 12 Hours'],
    tags: ['diffuser', 'aromatherapy', 'wellness', 'home'],
    description: 'Diffuses soothing eucalyptus or lavender essential oils into a fine cool mist that eases anxiety and promotes sound sleep.'
  },
  {
    title: 'BarberCut Cordless Titanium Beard & Hair Trimmer',
    category: 'Health & Beauty',
    brand: 'SonicDent',
    price: 49.99,
    original_price: 65.00,
    rating: 4.6,
    reviews_count: 210,
    stock: 28,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1621607512214-68297480165e?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1621607512214-68297480165e?w=800&q=80'],
    features: ['Self-Sharpening Titanium T-Blade (Zero Gapped)', '7,200 RPM High-Torque Rotary Motor', '200-Minute Cordless Runtime on Lithium-Ion', '4 Guide Combs (1.5mm - 6mm)', 'LCD Battery Percentage Display'],
    tags: ['shaver', 'grooming', 'hair-clipper', 'beard'],
    description: 'Sharp lines and clean fades without pulling or snagging. Full waterproof chassis rinses clean under running taps.'
  },
  {
    title: 'AuraGlow High-Speed Ionic Hair Dryer 110,000 RPM',
    category: 'Health & Beauty',
    brand: 'DermaGlow',
    price: 139.99,
    original_price: 179.99,
    rating: 4.8,
    reviews_count: 140,
    stock: 16,
    badge: 'Hot Deal',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80'],
    features: ['110,000 RPM Brushless Digital Motor', '200 Million Negative Ions Eliminate Frizz', 'Intelligent Thermo-Sensor Measures Heat 100x/sec', '3 Magnetic Attachments (Diffuser & Concentrator)', 'Weighs only 0.9 lbs for Painless Styling'],
    tags: ['hair-dryer', 'beauty', 'styling', 'ionic'],
    description: 'Dries thick hair in under 5 minutes without extreme heat damage. Ultra-lightweight ergonomic balanced balance.'
  },
  {
    title: 'ThermaGun Deep Tissue Percussion Massage Gun',
    category: 'Health & Beauty',
    brand: 'PulseFit',
    price: 89.00,
    original_price: 120.00,
    rating: 4.7,
    reviews_count: 310,
    stock: 24,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80'],
    features: ['14mm Amplitude Deep Muscle Penetration', '30 Adjustable Speed Levels up to 3200 RPM', '6 Interchangeable Therapy Head Attachments', 'Quiet Glide Technology Under 40dB', '6 Hours Continuous Battery Life'],
    tags: ['massage-gun', 'recovery', 'fitness', 'wellness'],
    description: 'Relieve muscle knots, soreness, and post-workout stiffness. Delivers targeted percussion pulses to stimulate blood flow.'
  },
  {
    title: 'SilkSleep 100% Pure Mulberry Silk Pillowcase (Queen)',
    category: 'Health & Beauty',
    brand: 'AuraCraft',
    price: 36.99,
    original_price: 48.00,
    rating: 4.9,
    reviews_count: 420,
    stock: 50,
    badge: 'Top Rated',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80'],
    features: ['OEKO-TEX Certified 22-Momme Silk', 'Hidden Zipper Closure Won\'t Poke', 'Naturally Hypoallergenic & Dust Mite Proof', 'Cool to the Touch All Night Long', 'Prevents Bedhead Hair Tangling and Friction'],
    tags: ['pillowcase', 'silk', 'bedding', 'skincare'],
    description: 'Wake up with salon-smooth hair and refreshed skin. Does not absorb face creams or natural facial moisture.'
  },
  {
    title: 'ZenStone Acupressure Mat & Neck Pillow Set',
    category: 'Health & Beauty',
    brand: 'PulseFit',
    price: 34.99,
    original_price: 45.00,
    rating: 4.6,
    reviews_count: 170,
    stock: 32,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80'],
    features: ['7,920 Non-Toxic Acupressure Spikes', '100% Eco-Friendly Organic Linen & Coconut Fiber', 'Releases Endorphins & Unwinds Sciatic Tension', 'Rolls up into Compact Canvas Tote', 'Includes Contoured Cervical Neck Cushion'],
    tags: ['acupressure', 'back-pain', 'relaxation', 'yoga'],
    description: 'Lie down for 15 minutes to trigger natural endorphin release, ease tension headaches, and soothe sore back muscles.'
  },
  {
    title: 'DermaRoller 0.5mm Titanium Microneedle Face Roller',
    category: 'Health & Beauty',
    brand: 'DermaGlow',
    price: 18.99,
    original_price: 25.00,
    rating: 4.5,
    reviews_count: 160,
    stock: 75,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80'],
    features: ['540 Medical-Grade Titanium Needles', 'Enhances Skincare Serum Absorption by 300%', 'Ergonomic Non-Slip Matte Handle', 'Sanitization Travel Storage Case Included', 'Gentle Exfoliation for Glowing Skin'],
    tags: ['microneedling', 'skincare', 'roller', 'beauty'],
    description: 'Roll lightly before applying hyaluronic acid or retinol to dramatically boost active absorption and skin renewal.'
  },
  {
    title: 'PureSmiles Activated Charcoal Teeth Whitening Kit',
    category: 'Health & Beauty',
    brand: 'SonicDent',
    price: 26.99,
    original_price: 35.00,
    rating: 4.4,
    reviews_count: 230,
    stock: 45,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1559591937-e10220263f35?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1559591937-e10220263f35?w=800&q=80'],
    features: ['Enamel-Safe Non-Peroxide Formula', 'Organic Coconut Charcoal + Bentonite Clay', 'Removes Coffee, Wine & Tobacco Stains', 'Includes 2 Soft Bamboo Bristle Brushes', 'Minty Fresh Breath Infusion'],
    tags: ['whitening', 'teeth', 'natural', 'oral-care'],
    description: 'Lift deep stubborn coffee and tea surface stains gently without harsh chemical sensitivity.'
  },
  {
    title: 'AuraMist Ultrasonic Facial Nano Steamer',
    category: 'Health & Beauty',
    brand: 'DermaGlow',
    price: 38.99,
    original_price: 49.99,
    rating: 4.7,
    reviews_count: 145,
    stock: 22,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&q=80'],
    features: ['Generates Nano-Ionic Steam 10x More Penetrating', 'Opens Pores for Blackhead Cleansing', 'Warm 30-Second Rapid Steam Generation', 'Built-in Aromatherapy Fruit & Flower Basket', 'Automatic Shut-Off When Water Tank is Empty'],
    tags: ['facial-steamer', 'skincare', 'pores', 'spa'],
    description: 'Recreate luxurious spa facials at home. Softens blackheads and readies skin for deep cleansing and masks.'
  },

  // 80-90: Sports & Fitness
  {
    title: 'TitanGrip Adjustable Quick-Lock Dumbbells 50 lbs (Pair)',
    category: 'Sports & Outdoors',
    brand: 'TitanGrip',
    price: 299.00,
    original_price: 369.00,
    rating: 4.9,
    reviews_count: 215,
    stock: 12,
    badge: 'Best Seller',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80'],
    features: ['Replaces 16 Individual Dumbbells per Pair', 'Fast 1-Second Twist Handle Dial Selection', 'Increments from 5 lbs up to 52.5 lbs', 'Laser-Cut Steel Plates with Poly Mold Coating', 'Heavy-Duty Storage Dock Included'],
    tags: ['dumbbells', 'weights', 'home-gym', 'fitness'],
    description: 'Transform your living room into an iron paradise. Shift weights with a simple flick of your wrist.'
  },
  {
    title: 'AuraAlign Natural Cork Non-Slip Yoga Mat 6mm',
    category: 'Sports & Outdoors',
    brand: 'PulseFit',
    price: 59.99,
    original_price: 75.00,
    rating: 4.8,
    reviews_count: 180,
    stock: 30,
    badge: 'Staff Pick',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80'],
    features: ['100% Organic Mediterranean Oak Cork', 'Grip Increases as You Sweat (Anti-Slip)', 'Heavy Natural Rubber Base Won\'t Curl Edges', 'Laser-Etched Body Alignment Laser Guides', 'Includes Cotton Carry Strap'],
    tags: ['yoga-mat', 'cork', 'fitness', 'pilates'],
    description: 'Unshakable grip for hot yoga, vinyasa, and pilates. Cork contains natural suberin that gets stickier with sweat.'
  },
  {
    title: 'HydroShield 32oz Insulated Stainless Steel Flask',
    category: 'Sports & Outdoors',
    brand: 'HydroShield',
    price: 29.99,
    original_price: 38.00,
    rating: 4.9,
    reviews_count: 490,
    stock: 70,
    badge: 'Popular',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800&q=80'],
    features: ['Keeps Cold 24 Hours & Piping Hot 12 Hours', 'Double-Wall Vacuum 18/8 Pro-Grade Steel', 'Powder-Coat Grip Sweat-Free Surface', 'Includes Straw Lid & Wide-Mouth Chug Cap', 'BPA-Free & Fits Standard Cup Holders'],
    tags: ['water-bottle', 'hydration', 'fitness', 'travel'],
    description: 'Keep ice solid even inside a scorching car on summer afternoons. Leakproof caps handle gym bags without worry.'
  },
  {
    title: 'PeakTrail Ultralight 2-Person Backpacking Tent',
    category: 'Sports & Outdoors',
    brand: 'PeakTrail',
    price: 179.99,
    original_price: 220.00,
    rating: 4.7,
    reviews_count: 98,
    stock: 15,
    badge: 'Hot Deal',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80'],
    features: ['Weighs Just 3.9 lbs Total Trail Weight', '20D Ripstop Silicone Rainfly 3000mm Rating', 'Freestanding 7001 Aircraft Aluminum Poles', 'Dual Vestibules & Dual Large Entrance Doors', 'Packs Down Small to 16x5 Inches'],
    tags: ['tent', 'camping', 'backpacking', 'outdoor'],
    description: 'Spacious interior room with zero weight penalty. Sets up in under 3 minutes with color-coded poles.'
  },
  {
    title: 'FlexLoop Heavy Resistance Bands Set (5-Pack)',
    category: 'Sports & Outdoors',
    brand: 'TitanGrip',
    price: 24.99,
    original_price: 32.00,
    rating: 4.7,
    reviews_count: 310,
    stock: 65,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80'],
    features: ['100% Natural Malaysian Latex (Snap-Resistant)', 'Color-Coded Resistance from 10 lbs to 50 lbs', 'Includes Door Anchor, Ankle Straps & Handles', 'Compact Waterproof Mesh Travel Sack', 'Full Body Training Exercise Guide Poster'],
    tags: ['resistance-bands', 'home-workout', 'fitness', 'travel'],
    description: 'Mimic cable machine exercises anywhere. Ideal for glute warmups, rehab stretches, and pull-up assistance.'
  },
  {
    title: 'AeroSpeed High-Speed Aluminum Bearing Jump Rope',
    category: 'Sports & Outdoors',
    brand: 'PulseFit',
    price: 19.99,
    original_price: 26.00,
    rating: 4.6,
    reviews_count: 220,
    stock: 50,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&q=80'],
    features: ['360° Dual Stainless Steel Ball Bearings', 'Kink-Free Coated Steel Cable with Spare Wire', 'Knurled Aluminum Non-Slip Grip Handles', 'Self-Locking Screwless Length Adjustment', 'Engineered for Crushing Double-Unders'],
    tags: ['jump-rope', 'cardio', 'boxing', 'crossfit'],
    description: 'Ultra-fast rotation with zero drag or tangling. Burns max calories in minimal high-intensity training intervals.'
  },
  {
    title: 'SummitClimb 45L Mountain Trekking Rucksack',
    category: 'Sports & Outdoors',
    brand: 'PeakTrail',
    price: 99.99,
    original_price: 130.00,
    rating: 4.8,
    reviews_count: 140,
    stock: 20,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'],
    features: ['Suspended Mesh Air-Flow Lumbar Back Panel', 'Tear-Resistant 420D Oxford Nylon', 'Trekking Pole & Ice Axe Attachment Loops', 'Integrated High-Visibility Rain Cover', 'Hydration Bladder 3L Internal Sleeve'],
    tags: ['backpack', 'hiking', 'rucksack', 'outdoors'],
    description: 'Carries heavy loads comfortably with ergonomic padded hip belt that transfers weight directly off your shoulders.'
  },
  {
    title: 'GripPro High-Density Foam Roller with Trigger Grid',
    category: 'Sports & Outdoors',
    brand: 'PulseFit',
    price: 24.99,
    original_price: 32.99,
    rating: 4.7,
    reviews_count: 260,
    stock: 45,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80'],
    features: ['Multi-Density 3D Surface Pattern', 'Solid Rigid Hollow Core Supports 500 lbs', 'Targeted Myofascial Knot Release', '13 x 5.5 Inch Travel Portable Dimension', 'Easy-Wipe Moisture Resistant EVA Foam'],
    tags: ['foam-roller', 'recovery', 'mobility', 'stretching'],
    description: 'Roll out tight hamstrings, calves, and IT bands before and after strenuous workouts to maintain flexibility.'
  },
  {
    title: 'TrailBlazer Carbon Fiber Trekking Poles (Pair)',
    category: 'Sports & Outdoors',
    brand: 'PeakTrail',
    price: 54.99,
    original_price: 70.00,
    rating: 4.8,
    reviews_count: 165,
    stock: 28,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80'],
    features: ['100% 3K Carbon Fiber Shock Absorbing Shafts', 'Natural Moisture-Wicking Cork Handles', 'Quick Flip Lock Aluminum Levers', 'Tungsten Carbide Tips & Mud Baskets', 'Collapses down to 24 inches'],
    tags: ['trekking-poles', 'hiking', 'carbon-fiber', 'mountains'],
    description: 'Save your knees on steep descents and power uphill with ultralight shock-absorbing carbon poles.'
  },
  {
    title: 'GripMaster Iron Hand Gripper Strengthener Set',
    category: 'Sports & Outdoors',
    brand: 'TitanGrip',
    price: 21.99,
    original_price: 28.00,
    rating: 4.6,
    reviews_count: 180,
    stock: 55,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&q=80'],
    features: ['Torsion Springs from 50 lbs to 200 lbs', 'Diamond Knurled Anodized Aluminum Handles', 'Builds Forearm Density & Crushing Grip', 'Pocket Sized for Daily Desk Training', 'Includes Silicone Protective Grip Sleeves'],
    tags: ['grip', 'forearm', 'strength', 'calisthenics'],
    description: 'Develop vice-like grip strength for deadlifts, rock climbing, martial arts, and racket sports.'
  },
  {
    title: 'SolarShower 5-Gallon Solar Heated Camp Shower',
    category: 'Sports & Outdoors',
    brand: 'PeakTrail',
    price: 27.99,
    original_price: 36.00,
    rating: 4.4,
    reviews_count: 110,
    stock: 35,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80'],
    features: ['Heats Water to 113°F (45°C) in 3 Hours of Sun', '4-Ply Durable PVC Construction', 'On/Off Adjustable Shower Head Nozzle', 'Water Temperature Indicator Gauge', 'Folds Flat for Minimal Space Storage'],
    tags: ['shower', 'camping', 'solar', 'vanlife'],
    description: 'Enjoy a refreshing hot shower after dusty hikes and beach surf sessions anywhere in the wild.'
  },

  // 91-100: Smart Home & Living
  {
    title: 'RoboClean Max LiDAR Robot Vacuum & Mop',
    category: 'Smart Home & Living',
    brand: 'RoboHome',
    price: 399.00,
    original_price: 499.00,
    rating: 4.8,
    reviews_count: 240,
    stock: 14,
    badge: 'Best Seller',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80'],
    features: ['5000Pa Deep Hyper-Suction', 'LiDAR Precision Room Mapping with No-Go Zones', 'Sonic Vibrating Scrub Mop', 'Auto Carpet Detection & Boost', '180-Minute Extended Runtime on Single Charge'],
    tags: ['robot-vacuum', 'mop', 'smart-home', 'cleaning'],
    description: 'Maps your home in minutes and vacuums pet hair and crumbs with surgical efficiency while mopping hardwoods.'
  },
  {
    title: 'LumiGlow RGBIC Smart LED Floor Lamp Corner Bar',
    category: 'Smart Home & Living',
    brand: 'LumiGlow',
    price: 79.99,
    original_price: 109.99,
    rating: 4.7,
    reviews_count: 195,
    stock: 25,
    badge: 'Trending',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80'],
    features: ['16 Million Colors & Segmented RGBIC Effects', 'Built-in Mic Syncs Dynamic Lights to Music', 'Alexa, Google Assistant & Smart App Control', 'Sleek Minimal Triangular Aluminum Corner Base', 'Timer Schedules & Sunrise Wake-Up Alarm'],
    tags: ['lighting', 'smart-lamp', 'rgb', 'home-decor'],
    description: 'Cast glowing ambient gradients along bedroom or living room walls. Pulses dynamically to movie audio and playlists.'
  },
  {
    title: 'AeroPure Smart True HEPA Air Purifier 500 sq ft',
    category: 'Smart Home & Living',
    brand: 'AeroTech',
    price: 119.99,
    original_price: 149.99,
    rating: 4.9,
    reviews_count: 320,
    stock: 30,
    badge: 'Top Rated',
    is_featured: 1,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80'],
    features: ['H13 Medical-Grade HEPA + Carbon Filter', 'Captures 99.97% of Pet Dander, Smoke, & Pollen', 'Laser PM2.5 Real-Time Air Quality Sensor', 'Ultra-Quiet 22dB Sleep Mode with Display Off', 'Smart WiFi App Notification for Filter Changes'],
    tags: ['air-purifier', 'hepa', 'allergies', 'clean-air'],
    description: 'Cleanse the air in large master bedrooms in under 12 minutes. Auto mode automatically adjusts fan speed based on dust and pollen spikes.'
  },
  {
    title: 'SecureView 2K Solar Wireless Outdoor Security Cam',
    category: 'Smart Home & Living',
    brand: 'RoboHome',
    price: 89.99,
    original_price: 119.00,
    rating: 4.6,
    reviews_count: 160,
    stock: 22,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&q=80'],
    features: ['Forever Power via Integrated Top Solar Panel', '2K QHD Crisp Resolution with Color Night Vision', 'PIR Human AI Motion Detection (Zero False Alarms)', 'Two-Way Audio Talk & 105dB Deterrent Siren', 'Local Encrypted MicroSD Storage (No Monthly Fees)'],
    tags: ['security-camera', 'solar', 'smart-home', 'cctv'],
    description: 'Never climb ladders to charge batteries again. Continuous solar trickling keeps your perimeter safe 365 days a year.'
  },
  {
    title: 'NestSmart WiFi Smart Thermostat with Remote Sensor',
    category: 'Smart Home & Living',
    brand: 'LumiGlow',
    price: 149.00,
    original_price: 189.00,
    rating: 4.7,
    reviews_count: 130,
    stock: 18,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80'],
    features: ['Saves up to 23% Annually on HVAC Energy', 'Learns Schedule & Auto-Adjusts When Away', 'Included Remote Sensor Balances Hot/Cold Spots', 'Sleek Mirrored Glass Touch Faceplate', 'Compatible with 95% of 24V Heating & AC Systems'],
    tags: ['thermostat', 'smart-home', 'energy-saving', 'wifi'],
    description: 'Cut electricity and gas bills while enjoying automated temperature comfort tailored to your family habits.'
  },
  {
    title: 'SenseLock Smart Deadbolt with Keypad & Fingerprint',
    category: 'Smart Home & Living',
    brand: 'RoboHome',
    price: 129.99,
    original_price: 169.99,
    rating: 4.8,
    reviews_count: 145,
    stock: 20,
    badge: 'Staff Pick',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1558002038-1055907df827?w=800&q=80'],
    features: ['6-in-1 Unlock: Fingerprint, PIN, App, Key, NFC, Alexa', '0.3-Second Swedish Biometric Recognition', 'Temporary Timed Guest Access Codes', 'Auto-Lock Sensor When Door Closes', 'BHMA Grade 2 Certified Solid Security'],
    tags: ['smart-lock', 'security', 'fingerprint', 'front-door'],
    description: 'Leave home without keys. Grant cleaner or pet-sitter temporary access codes that expire automatically.'
  },
  {
    title: 'HydroGarden Smart Indoor Hydroponic Herb Kit',
    category: 'Smart Home & Living',
    brand: 'LumiGlow',
    price: 79.99,
    original_price: 99.99,
    rating: 4.7,
    reviews_count: 110,
    stock: 25,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800&q=80'],
    features: ['Grows Plants 5x Faster than Soil Gardening', 'Full-Spectrum 24W LED Grow Light with Auto Timer', 'Built-in Water Circulation Pump Oxygenates Roots', 'Grow 12 Pods Simultaneously (Basil, Mint, Thyme)', 'Visual Water Level Indicator Window'],
    tags: ['hydroponics', 'gardening', 'herbs', 'kitchen'],
    description: 'Harvest fresh organic herbs year-round right from your kitchen counter with no dirt, mess, or pesticides.'
  },
  {
    title: 'AeroPlug Smart WiFi Energy Monitoring Plug (4-Pack)',
    category: 'Smart Home & Living',
    brand: 'LumiGlow',
    price: 29.99,
    original_price: 39.99,
    rating: 4.6,
    reviews_count: 280,
    stock: 60,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=800&q=80'],
    features: ['Real-Time Kilowatt-Hour Power Consumption Tracker', 'Control Appliances Remotely from Smartphone', 'Set Customized Countdown Timers & Schedules', 'Slim Compact Size Leaves Adjacent Outlets Free', 'Works with Alexa & Google Assistant (No Hub Needed)'],
    tags: ['smart-plug', 'energy', 'smart-home', 'automation'],
    description: 'Turn dumb space heaters, lamps, and espresso makers into smart connected devices with instant phone control.'
  },
  {
    title: 'RainDrop Smart Wi-Fi 8-Zone Sprinkler Controller',
    category: 'Smart Home & Living',
    brand: 'RoboHome',
    price: 99.00,
    original_price: 130.00,
    rating: 4.8,
    reviews_count: 85,
    stock: 15,
    badge: '',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&q=80'],
    features: ['Weather Intelligence Skips Watering During Rain/Freeze', 'Controls up to 8 Distinct Lawn & Garden Zones', 'EPA WaterSense Certified (Cuts Lawn Bill 50%)', 'Quick Manual Soak Button on Faceplate', 'Intuitive Smartphone App Setup in 15 Minutes'],
    tags: ['sprinkler', 'irrigation', 'lawn', 'smart-home'],
    description: 'Keep your lawn lush green without wasting water. Automatically pulls local weather forecast to skip watering during rainstorms.'
  },
  {
    title: 'SoundCalm White Noise Sound Machine with Warm Light',
    category: 'Smart Home & Living',
    brand: 'AuraCraft',
    price: 34.99,
    original_price: 45.00,
    rating: 4.8,
    reviews_count: 310,
    stock: 40,
    badge: 'Popular',
    is_featured: 0,
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80',
    images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&q=80'],
    features: ['30 Non-Looping Soothing Sounds (Ocean, Fan, Rain)', 'Warm Stepless Dimming Nightlight', 'Sleep Timer 30, 60, 90 Minutes or Continuous', 'Memory Function Recalls Last Sound & Volume', 'Compact Travel Friendly USB Powered Design'],
    tags: ['white-noise', 'sleep', 'sound-machine', 'nursery'],
    description: 'Mask noisy street traffic and barking dogs for undisturbed slumber for both adults and sleeping infants.'
  }
];

function seed() {
  console.log('Replacing the ApexStore product catalog while preserving orders and account data...');

  if (!fs.existsSync(IMPORTED_CATALOG_PATH)) {
    throw new Error('Missing catalog-source.json. Run `npm run catalog:download` before seeding.');
  }
  const imported = JSON.parse(fs.readFileSync(IMPORTED_CATALOG_PATH, 'utf8'));
  if (!Array.isArray(imported.products) || imported.products.length === 0) {
    throw new Error('catalog-source.json must contain at least one imported product.');
  }

  // Seed Categories
  const catStmt = db.prepare(`
    INSERT INTO categories (name, slug, description, icon, image)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET slug=excluded.slug, description=excluded.description, icon=excluded.icon, image=excluded.image
  `);
  for (const c of categories) {
    catStmt.run(c.name, c.slug, c.description, c.icon, c.image);
  }
  console.log(`Inserted ${categories.length} categories.`);

  // Seed Coupons
  const coupStmt = db.prepare(`
    INSERT INTO coupons (code, discount_percent, min_spend, is_active)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(code) DO NOTHING
  `);
  for (const cp of coupons) {
    coupStmt.run(cp.code, cp.discount_percent, convertUsdToInr(cp.min_spend));
  }
  console.log(`Inserted ${coupons.length} discount coupons.`);

  // Replace the catalog and its reviews with the latest internet-sourced snapshot.
  run('DELETE FROM reviews');
  run('DELETE FROM products');

  // Seed Products
  const prodStmt = db.prepare(`
    INSERT INTO products (
      title, slug, description, category, price, original_price,
      rating, reviews_count, stock, image, images, features,
      specifications, faqs, source, source_ref, brand, badge, tags, is_featured
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const reviewStmt = db.prepare(`
    INSERT INTO reviews (product_id, author, rating, comment, date, verified)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const importedStmt = db.prepare(`
    INSERT INTO products (
      title, slug, description, category, price, original_price, rating, reviews_count,
      stock, image, images, features, specifications, faqs, source, source_ref,
      brand, badge, tags, is_featured, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of imported.products) {
    const sourceCategory = p.source_category || p.specifications?.find(spec => spec.label === 'Category')?.value || p.category;
    const category = categoryFor(sourceCategory, p.title, p.description) || p.category;
    const specifications = p.specifications || [];
    const faqs = p.faqs || [];
    const slug = `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${p.source_ref.slice(0, 8)}`;
    importedStmt.run(p.title, slug, p.description, category, convertUsdToInr(p.price), convertUsdToInr(p.original_price), p.rating, p.reviews_count,
      p.stock, p.image, JSON.stringify(p.images || [p.image]), JSON.stringify(p.features || []),
      JSON.stringify(specifications), JSON.stringify(faqs), p.source, p.source_ref, p.brand || '', '',
      JSON.stringify(p.tags || []), 0, 1);
    const productId = Number(queryOne('SELECT id FROM products WHERE source_ref = ?', [p.source_ref]).id);
    for (const review of p.reviews || []) {
      reviewStmt.run(productId, review.author, review.rating, review.comment, review.date || new Date().toISOString().slice(0, 10), 1);
    }
  }

  seedDemoAccounts();

  const countRow = queryOne('SELECT count(*) as total FROM products');
  console.log(`Catalog now contains ${countRow.total} internet-sourced products with reviews, specifications, and FAQs.`);
}

function seedDemoAccounts() {
  const hashPassword = password => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
  };
  const products = queryAll('SELECT id, title, price, image FROM products WHERE is_active = 1 ORDER BY id LIMIT 6');
  if (products.length < 4) throw new Error('At least four active products are required to seed demo accounts.');

  for (let index = 0; index < demoAccounts.length; index += 1) {
    const account = demoAccounts[index];
    let user = queryOne('SELECT id FROM users WHERE email = ?', [account.email]);
    if (!user) {
      const credentials = hashPassword(account.password);
      run('INSERT INTO users (name, email, password_salt, password_hash, email_verified) VALUES (?, ?, ?, ?, 1)', [
        account.name, account.email, credentials.salt, credentials.hash
      ]);
      user = queryOne('SELECT id FROM users WHERE email = ?', [account.email]);
    }

    const orderId = `DEMO-${index + 1}-20261106`;
    if (queryOne('SELECT id FROM orders WHERE id = ?', [orderId])) continue;
    const first = products[index * 2];
    const second = products[index * 2 + 1];
    const items = [
      { id: first.id, title: first.title, price: first.price, quantity: 1, image: first.image },
      { id: second.id, title: second.title, price: second.price, quantity: 1, image: second.image }
    ];
    const subtotal = Number((first.price + second.price).toFixed(2));
    const shippingFee = subtotal > 999 ? 0 : 49;
    const tax = Number((subtotal * 0.18).toFixed(2));
    const total = Number((subtotal + shippingFee + tax).toFixed(2));
    run(`INSERT INTO orders (
      id, customer_name, customer_email, customer_phone, shipping_address, city, postal_code,
      payment_method, items, subtotal, discount, shipping_fee, tax, total, currency, status,
      delivered_at, user_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'INR', 'Delivered', ?, ?, ?)`, [
      orderId, account.name, account.email, '9876543210', `${index + 1} Demo Street, Koramangala`,
      'Bengaluru', '560034', 'Cash on Delivery', JSON.stringify(items), subtotal, shippingFee, tax,
      total, '2026-11-03 10:00:00', user.id, '2026-10-28 10:00:00'
    ]);
    appendDemoOrderHistory(orderId, user.id);
    const returnItem = items[0];
    const returnAmount = Number((returnItem.price * 1.18).toFixed(2));
    run(`INSERT INTO refund_requests (
      order_id, requested_by, items, amount, reason, status, created_at
    ) VALUES (?, ?, ?, ?, ?, 'Requested', ?)`, [
      orderId, user.id, JSON.stringify([{
        product_id: returnItem.id,
        title: returnItem.title,
        quantity: 1,
        unit_price: returnItem.price,
        refund_amount: returnAmount
      }]), returnAmount, 'Demo return request for testing the customer refund workflow.', '2026-11-05 12:00:00'
    ]);
  }
  console.log(`Seeded ${demoAccounts.length} demo accounts with delivered orders and return requests.`);
}

function appendDemoOrderHistory(orderId, userId) {
  const statuses = [
    [null, 'Processing', 'Demo order created'],
    ['Processing', 'Confirmed', 'Demo order confirmed'],
    ['Confirmed', 'Shipped', 'Demo order shipped'],
    ['Shipped', 'Delivered', 'Demo order delivered']
  ];
  for (const [oldStatus, newStatus, note] of statuses) {
    run('INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note) VALUES (?, ?, ?, ?, ?)', [
      orderId, oldStatus, newStatus, userId, note
    ]);
  }
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
