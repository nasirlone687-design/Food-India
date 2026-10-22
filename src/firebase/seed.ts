import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  getDocs,
  setDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from './config';

export interface SeedCategoryDef {
  id: string;
  name: string;
  image: string;
  subcategories: string[];
}

export const INDIAN_FOOD_CATEGORIES: SeedCategoryDef[] = [
  {
    id: 'biryani-pulao',
    name: 'Biryani & Pulao',
    image: 'https://images.unsplash.com/photo-1563379091339-03b17af4a4af?w=300&h=300&fit=crop',
    subcategories: ['Hyderabadi Biryani', 'Lucknowi Biryani', 'Kolkata Biryani', 'Kashmiri Pulao', 'Veg Dum Biryani'],
  },
  {
    id: 'north-indian',
    name: 'North Indian Curries',
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&h=300&fit=crop',
    subcategories: ['Dal Makhani', 'Butter Chicken', 'Rogan Josh', 'Malai Kofta', 'Kadhi Pakora'],
  },
  {
    id: 'south-indian',
    name: 'South Indian',
    image: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=300&h=300&fit=crop',
    subcategories: ['Idli Sambar', 'Medu Vada', 'Pongal', 'Appam & Stew', 'Curd Rice'],
  },
  {
    id: 'dosa-uttapam',
    name: 'Dosas & Uttapam',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=300&h=300&fit=crop',
    subcategories: ['Masala Dosa', 'Mysore Masala Dosa', 'Rava Dosa', 'Onion Tomato Uttapam', 'Ghee Roast Dosa'],
  },
  {
    id: 'paneer-veg',
    name: 'Paneer & Veg',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=300&h=300&fit=crop',
    subcategories: ['Paneer Butter Masala', 'Kadai Paneer', 'Palak Paneer', 'Shahi Paneer', 'Mushroom Masala'],
  },
  {
    id: 'tandoori-kebabs',
    name: 'Tandoori & Kebabs',
    image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=300&h=300&fit=crop',
    subcategories: ['Tandoori Chicken', 'Paneer Tikka', 'Mutton Seekh Kebab', 'Chicken Malai Tikka', 'Hara Bhara Kebab'],
  },
  {
    id: 'thali-combos',
    name: 'Thalis & Meals',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=300&h=300&fit=crop',
    subcategories: ['Maharaja Veg Thali', 'Deluxe Non-Veg Thali', 'South Indian Banana Leaf Meal', 'Mini Executive Thali'],
  },
  {
    id: 'street-food-chaat',
    name: 'Street Food & Chaat',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&h=300&fit=crop',
    subcategories: ['Pani Puri / Golgappa', 'Mumbai Pav Bhaji', 'Vada Pav', 'Papdi Chaat', 'Aloo Tikki Chaat'],
  },
  {
    id: 'parathas-breads',
    name: 'Parathas & Breads',
    image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=300&h=300&fit=crop',
    subcategories: ['Aloo Paratha', 'Amritsari Kulcha', 'Garlic Butter Naan', 'Laccha Paratha', 'Tandoori Roti'],
  },
  {
    id: 'chicken-mutton',
    name: 'Chicken & Mutton',
    image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300&h=300&fit=crop',
    subcategories: ['Chicken Tikka Masala', 'Laal Maas', 'Chicken Chettinad', 'Keema Kaleji', 'Handi Mutton'],
  },
  {
    id: 'kashmiri-wazwan',
    name: 'Kashmiri Wazwan',
    image: 'https://images.unsplash.com/photo-1541014741259-df549cae7744?w=300&h=300&fit=crop',
    subcategories: ['Rista', 'Gushtaba', 'Tabak Maaz', 'Kashmiri Dum Aloo', 'Nadru Yakhni'],
  },
  {
    id: 'punjabi-dhaba',
    name: 'Punjabi Dhaba',
    image: 'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=300&h=300&fit=crop',
    subcategories: ['Chole Bhature', 'Rajma Chawal', 'Sarson da Saag & Makki di Roti', 'Pindi Chana'],
  },
  {
    id: 'momos-indo-chinese',
    name: 'Momos & Indo-Chinese',
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c170db76?w=300&h=300&fit=crop',
    subcategories: ['Steamed Momos', 'Tandoori Kurkure Momos', 'Veg Manchurian', 'Chilli Paneer', 'Hakka Noodles'],
  },
  {
    id: 'rolls-kathi',
    name: 'Kathi Rolls & Wraps',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97eb4?w=300&h=300&fit=crop',
    subcategories: ['Kolkata Egg Chicken Roll', 'Paneer Tikka Kathi Roll', 'Double Egg Roll', 'Mutton Seekh Roll'],
  },
  {
    id: 'rajasthani-gujarati',
    name: 'Rajasthani & Gujarati',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=300&h=300&fit=crop',
    subcategories: ['Dal Baati Churma', 'Khaman Dhokla', 'Khandvi', 'Methi Thepla', 'Gatte ki Sabzi'],
  },
  {
    id: 'maharashtrian',
    name: 'Maharashtrian',
    image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=300&h=300&fit=crop',
    subcategories: ['Kolhapuri Misal Pav', 'Puran Poli', 'Sabudana Khichdi', 'Kanda Poha', 'Thalipeeth'],
  },
  {
    id: 'bengali-coastal',
    name: 'Bengali & Coastal',
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=300&h=300&fit=crop',
    subcategories: ['Kosha Mangsho', 'Shorshe Ilish / Fish Curry', 'Goan Prawn Balchao', 'Malabar Parotta & Fish Molee'],
  },
  {
    id: 'snacks-pakoras',
    name: 'Samosa & Snacks',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&h=300&fit=crop',
    subcategories: ['Punjabi Samosa', 'Pyaz Kachori', 'Mix Veg Pakora', 'Bread Pakora', 'Mirchi Vada'],
  },
  {
    id: 'sweets-mithai',
    name: 'Indian Sweets & Mithai',
    image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=300&h=300&fit=crop',
    subcategories: ['Hot Gulab Jamun', 'Kesar Rasmalai', 'Desi Ghee Jalebi', 'Gajar ka Halwa', 'Bengali Rasgulla'],
  },
  {
    id: 'lassi-beverages',
    name: 'Chai, Lassi & Drinks',
    image: 'https://images.unsplash.com/photo-1544145945-f904253d0c7e?w=300&h=300&fit=crop',
    subcategories: ['Kulhad Masala Chai', 'Punjabi Sweet Lassi', 'Alphonso Mango Lassi', 'Kumbakonam Filter Coffee', 'Masala Shikanji'],
  },
];

export const DEFAULT_TEST_RESTAURANT_ID = 'test_indian_darbar_res';
export const DEFAULT_TEST_SELLER_ID = 'test_indian_darbar_seller';

export interface SeedProductDef {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  subcategoryId: string;
  price: number;
  foodType: 'veg' | 'non-veg' | 'egg';
  image: string;
  prepMins: number;
  variants: { id: string; name: string; price: number }[];
  addOnGroups: {
    id: string;
    name: string;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
    options: { name: string; price: number }[];
  }[];
}

export const INDIAN_TEST_PRODUCTS: SeedProductDef[] = [
  {
    id: 'test_prod_hyderabadi_biryani',
    name: 'Hyderabadi Chicken Dum Biryani (Test)',
    description: 'Slow-cooked basmati rice layered with saffron, caramelized onions, mint, and tender marinated chicken in traditional Kachchi Dum style.',
    categoryId: 'biryani-pulao',
    subcategoryId: 'Hyderabadi Biryani',
    price: 280,
    foodType: 'non-veg',
    image: 'https://images.unsplash.com/photo-1563379091339-03b17af4a4af?w=600&h=450&fit=crop',
    prepMins: 25,
    variants: [
      { id: 'v_half', name: 'Regular (1 Person)', price: 0 },
      { id: 'v_full', name: 'Handi Full (2 Persons)', price: 160 },
      { id: 'v_family', name: 'Family Pack (4 Persons)', price: 420 },
    ],
    addOnGroups: [
      {
        id: 'ag_sides',
        name: 'Biryani Accompaniments',
        isRequired: false,
        minSelections: 0,
        maxSelections: 3,
        options: [
          { name: 'Extra Mirchi ka Salan', price: 35 },
          { name: 'Burhani Boondi Raita', price: 30 },
          { name: 'Boiled Masala Egg (2 pcs)', price: 40 },
        ],
      },
    ],
  },
  {
    id: 'test_prod_veg_dum_biryani',
    name: 'Subz Nizami Veg Dum Biryani (Test)',
    description: 'Fragrant long-grain basmati rice cooked on dum with fresh garden vegetables, paneer cubes, rose water, and roasted cashews.',
    categoryId: 'biryani-pulao',
    subcategoryId: 'Veg Dum Biryani',
    price: 220,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&h=450&fit=crop',
    prepMins: 20,
    variants: [
      { id: 'v_reg', name: 'Regular Handi', price: 0 },
      { id: 'v_large', name: 'Large Handi', price: 120 },
    ],
    addOnGroups: [
      {
        id: 'ag_raita',
        name: 'Extra Sides',
        isRequired: false,
        minSelections: 0,
        maxSelections: 2,
        options: [
          { name: 'Mint Cucumber Raita', price: 30 },
          { name: 'Roasted Papad (2 pcs)', price: 20 },
        ],
      },
    ],
  },
  {
    id: 'test_prod_butter_chicken',
    name: 'Old Delhi Butter Chicken (Test)',
    description: 'Charcoal-grilled tandoori chicken simmered in a rich, velvety tomato, butter, and kasuri methi gravy.',
    categoryId: 'north-indian',
    subcategoryId: 'Butter Chicken',
    price: 320,
    foodType: 'non-veg',
    image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&h=450&fit=crop',
    prepMins: 25,
    variants: [
      { id: 'v_boneless', name: 'Boneless Half', price: 0 },
      { id: 'v_full_boneless', name: 'Boneless Full', price: 180 },
    ],
    addOnGroups: [
      {
        id: 'ag_bread',
        name: 'Pair with Indian Bread',
        isRequired: false,
        minSelections: 0,
        maxSelections: 2,
        options: [
          { name: 'Butter Naan (2 pcs)', price: 70 },
          { name: 'Garlic Naan (2 pcs)', price: 90 },
          { name: 'Tandoori Butter Roti (2 pcs)', price: 45 },
        ],
      },
    ],
  },
  {
    id: 'test_prod_dal_makhani',
    name: '24-Hour Slow Cooked Dal Makhani (Test)',
    description: 'Whole black urad lentils and rajma slow-simmered overnight over charcoal with white butter, ginger, and fresh cream.',
    categoryId: 'north-indian',
    subcategoryId: 'Dal Makhani',
    price: 210,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=450&fit=crop',
    prepMins: 15,
    variants: [
      { id: 'v_300ml', name: 'Regular (300ml)', price: 0 },
      { id: 'v_500ml', name: 'Large (500ml)', price: 90 },
    ],
    addOnGroups: [],
  },
  {
    id: 'test_prod_paneer_butter_masala',
    name: 'Paneer Butter Masala (Test)',
    description: 'Soft malai paneer cubes tossed in a mildly sweet and tangy cashew-tomato makhani gravy finished with fresh cream.',
    categoryId: 'paneer-veg',
    subcategoryId: 'Paneer Butter Masala',
    price: 250,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&h=450&fit=crop',
    prepMins: 20,
    variants: [
      { id: 'v_half', name: 'Half Portion', price: 0 },
      { id: 'v_full', name: 'Full Portion', price: 110 },
    ],
    addOnGroups: [
      {
        id: 'ag_paneer_bread',
        name: 'Add Breads & Rice',
        isRequired: false,
        minSelections: 0,
        maxSelections: 2,
        options: [
          { name: 'Laccha Paratha', price: 45 },
          { name: 'Jeera Basmati Rice', price: 95 },
        ],
      },
    ],
  },
  {
    id: 'test_prod_masala_dosa',
    name: 'Mysore Ghee Roast Masala Dosa (Test)',
    description: 'Crispy fermented rice & lentil crepe roasted in pure cow ghee, smeared with fiery Mysore chutney and spiced potato palya. Served with sambar & 3 chutneys.',
    categoryId: 'dosa-uttapam',
    subcategoryId: 'Mysore Masala Dosa',
    price: 150,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=600&h=450&fit=crop',
    prepMins: 15,
    variants: [
      { id: 'v_classic', name: 'Classic Ghee Roast', price: 0 },
      { id: 'v_cheese', name: 'Cheese & Paneer Roast', price: 50 },
    ],
    addOnGroups: [
      {
        id: 'ag_dosa_extra',
        name: 'South Indian Extras',
        isRequired: false,
        minSelections: 0,
        maxSelections: 2,
        options: [
          { name: 'Crispy Medu Vada (1 pc)', price: 40 },
          { name: 'Extra Coconut Chutney', price: 20 },
        ],
      },
    ],
  },
  {
    id: 'test_prod_idli_vada',
    name: 'Rameshwaram Ghee Podi Idli & Vada Combo (Test)',
    description: 'Pillow-soft steamed idlis tossed in spicy gun-powder podi and pure melted ghee, paired with a crispy medu vada and piping hot arachuvitta sambar.',
    categoryId: 'south-indian',
    subcategoryId: 'Idli Sambar',
    price: 135,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1630383249896-424e482df921?w=600&h=450&fit=crop',
    prepMins: 12,
    variants: [
      { id: 'v_2idli_1vada', name: '2 Idli + 1 Vada', price: 0 },
      { id: 'v_4idli', name: '4 Ghee Podi Idli', price: 30 },
    ],
    addOnGroups: [],
  },
  {
    id: 'test_prod_tandoori_platter',
    name: 'Peshawari Tandoori Chicken & Kebab Platter (Test)',
    description: 'Smoky clay-oven roasted Tandoori Chicken, Chicken Malai Tikka, andSeekh Kebab served with mint chutney and masala onion rings.',
    categoryId: 'tandoori-kebabs',
    subcategoryId: 'Tandoori Chicken',
    price: 390,
    foodType: 'non-veg',
    image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&h=450&fit=crop',
    prepMins: 25,
    variants: [
      { id: 'v_half_platter', name: 'Half Platter (6 pcs)', price: 0 },
      { id: 'v_full_platter', name: 'Full Platter (12 pcs)', price: 240 },
    ],
    addOnGroups: [
      {
        id: 'ag_rumali',
        name: 'Add Bread',
        isRequired: false,
        minSelections: 0,
        maxSelections: 2,
        options: [
          { name: 'Rumali Roti (2 pcs)', price: 50 },
          { name: 'Extra Mint Curd Dip', price: 25 },
        ],
      },
    ],
  },
  {
    id: 'test_prod_paneer_tikka',
    name: 'Achari Paneer Tikka Skewers (Test)',
    description: 'Cottage cheese cubes, bell peppers, and onions marinated in hung curd and tangy North Indian pickling spices, charred in a tandoor.',
    categoryId: 'tandoori-kebabs',
    subcategoryId: 'Paneer Tikka',
    price: 240,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&h=450&fit=crop',
    prepMins: 20,
    variants: [{ id: 'v_6pcs', name: '6 Pieces', price: 0 }, { id: 'v_10pcs', name: '10 Pieces', price: 110 }],
    addOnGroups: [],
  },
  {
    id: 'test_prod_maharaja_thali',
    name: 'Maharaja Royal Veg Thali (Test)',
    description: 'Complete Indian feast: Paneer Butter Masala, Dal Makhani, Seasonal Veg, Jeera Pulao, 2 Butter Naan, Raita, Papad, Pickle & Hot Gulab Jamun.',
    categoryId: 'thali-combos',
    subcategoryId: 'Maharaja Veg Thali',
    price: 295,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&h=450&fit=crop',
    prepMins: 20,
    variants: [
      { id: 'v_std', name: 'Deluxe Thali (with 2 Butter Naan)', price: 0 },
      { id: 'v_roti', name: 'Tandoori Roti Thali (3 Rotis)', price: 0 },
    ],
    addOnGroups: [
      {
        id: 'ag_thali_drink',
        name: 'Add Beverage',
        isRequired: false,
        minSelections: 0,
        maxSelections: 1,
        options: [
          { name: 'Sweet Punjabi Lassi', price: 65 },
          { name: 'Masala Chaas (Buttermilk)', price: 35 },
        ],
      },
    ],
  },
  {
    id: 'test_prod_pav_bhaji',
    name: 'Mumbai Juhu Beach Butter Pav Bhaji (Test)',
    description: 'Rich mashed vegetable curry cooked on a flat tava with Amul butter and special Mumbai pav bhaji masala, served with 2 butter-toasted ladi pavs.',
    categoryId: 'street-food-chaat',
    subcategoryId: 'Mumbai Pav Bhaji',
    price: 160,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600&h=450&fit=crop',
    prepMins: 15,
    variants: [
      { id: 'v_regular', name: 'Amul Butter Pav Bhaji', price: 0 },
      { id: 'v_cheese', name: 'Cheese Overload Pav Bhaji', price: 45 },
    ],
    addOnGroups: [
      {
        id: 'ag_pav_extra',
        name: 'Extra Pav',
        isRequired: false,
        minSelections: 0,
        maxSelections: 2,
        options: [{ name: 'Extra Butter Pav Pair (2 pcs)', price: 35 }],
      },
    ],
  },
  {
    id: 'test_prod_pani_puri_chaat',
    name: 'Banarasi Dahi Bhalla & Papdi Chaat (Test)',
    description: 'Crispy flour wafers and lentil dumplings topped with chilled sweetened curd, tamarind date chutney, green mint chutney, and pomegranate pearls.',
    categoryId: 'street-food-chaat',
    subcategoryId: 'Papdi Chaat',
    price: 120,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=450&fit=crop',
    prepMins: 10,
    variants: [],
    addOnGroups: [],
  },
  {
    id: 'test_prod_amritsari_kulcha',
    name: 'Amritsari Aloo Pyaz Stuffed Kulcha with Chole (Test)',
    description: 'Crispy flaky tandoori kulcha stuffed with spiced potato, onion, pomegranate seeds & coriander, served with Amritsari Pindi Chole & tamarind onion chutney.',
    categoryId: 'parathas-breads',
    subcategoryId: 'Amritsari Kulcha',
    price: 175,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=450&fit=crop',
    prepMins: 18,
    variants: [
      { id: 'v_aloo', name: 'Aloo Pyaz Kulcha', price: 0 },
      { id: 'v_paneer', name: 'Paneer Mix Stuffed Kulcha', price: 40 },
    ],
    addOnGroups: [],
  },
  {
    id: 'test_prod_mutton_rogan_josh',
    name: 'Kashmiri Mutton Rogan Josh (Test)',
    description: 'Authentic tender goat meat braised in a fragrant gravy flavored with Kashmiri dry red chillies, fennel, ginger, and ratan jot.',
    categoryId: 'chicken-mutton',
    subcategoryId: 'Laal Maas',
    price: 380,
    foodType: 'non-veg',
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&h=450&fit=crop',
    prepMins: 30,
    variants: [
      { id: 'v_half', name: 'Half (2 Pcs)', price: 0 },
      { id: 'v_full', name: 'Full (4 Pcs)', price: 220 },
    ],
    addOnGroups: [],
  },
  {
    id: 'test_prod_kashmiri_wazwan_rista',
    name: 'Kashmiri Royal Wazwan Rista & Tabak Maaz (Test)',
    description: 'Hand-pounded tender mutton meatballs poached in fiery saffron-red gravy alongside crispy ghee-fried Kashmiri lamb ribs.',
    categoryId: 'kashmiri-wazwan',
    subcategoryId: 'Rista',
    price: 420,
    foodType: 'non-veg',
    image: 'https://images.unsplash.com/photo-1541014741259-df549cae7744?w=600&h=450&fit=crop',
    prepMins: 30,
    variants: [
      { id: 'v_rista', name: 'Rista Bowl (3 Balls)', price: 0 },
      { id: 'v_combo', name: 'Wazwan Rista + Tabak Maaz Combo', price: 160 },
    ],
    addOnGroups: [],
  },
  {
    id: 'test_prod_chole_bhature',
    name: 'Paharganj Special Chole Bhature (Test)',
    description: 'Two fluffy golden paneer-stuffed bhature served with dark spiced Pindi chole, pickled green chillies, amla achar, and masala aloo.',
    categoryId: 'punjabi-dhaba',
    subcategoryId: 'Chole Bhature',
    price: 165,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=600&h=450&fit=crop',
    prepMins: 15,
    variants: [],
    addOnGroups: [
      {
        id: 'ag_lassi_pair',
        name: 'Complete the Punjabi Meal',
        isRequired: false,
        minSelections: 0,
        maxSelections: 2,
        options: [
          { name: 'Extra Bhatura (1 pc)', price: 40 },
          { name: 'Kulhad Sweet Lassi', price: 70 },
        ],
      },
    ],
  },
  {
    id: 'test_prod_tandoori_momos',
    name: 'Tandoori Afghani Chicken Momos (Test)',
    description: 'Juicy dumplings marinated in spiced yogurt & cream, char-grilled in a clay tandoor and tossed with butter, chaat masala & mint chutney.',
    categoryId: 'momos-indo-chinese',
    subcategoryId: 'Tandoori Kurkure Momos',
    price: 190,
    foodType: 'non-veg',
    image: 'https://images.unsplash.com/photo-1534422298391-e4f8c170db76?w=600&h=450&fit=crop',
    prepMins: 18,
    variants: [
      { id: 'v_6pcs', name: '6 Pieces', price: 0 },
      { id: 'v_10pcs', name: '10 Pieces', price: 80 },
    ],
    addOnGroups: [],
  },
  {
    id: 'test_prod_kathi_roll',
    name: 'Kolkata Park Street Double Egg Chicken Kathi Roll (Test)',
    description: 'Flaky laccha paratha layered with two farm eggs, stuffed with smoky chicken tikka, crunchy onions, green chillies, lime juice & chaat masala.',
    categoryId: 'rolls-kathi',
    subcategoryId: 'Kolkata Egg Chicken Roll',
    price: 170,
    foodType: 'egg',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97eb4?w=600&h=450&fit=crop',
    prepMins: 15,
    variants: [
      { id: 'v_single', name: 'Single Egg Chicken Roll', price: 0 },
      { id: 'v_double', name: 'Double Egg Double Chicken Roll', price: 60 },
    ],
    addOnGroups: [],
  },
  {
    id: 'test_prod_dal_baati_churma',
    name: 'Jaipuri Royal Dal Baati Churma (Test)',
    description: 'Baked wheat dough balls dipped in pure desi ghee, served with Panchmel Dal, sweet almond-cardamom Churma, Gatte ki Sabzi, and garlic chutney.',
    categoryId: 'rajasthani-gujarati',
    subcategoryId: 'Dal Baati Churma',
    price: 260,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&h=450&fit=crop',
    prepMins: 22,
    variants: [],
    addOnGroups: [],
  },
  {
    id: 'test_prod_kolhapuri_misal_pav',
    name: 'Puneri & Kolhapuri Zanzanit Misal Pav (Test)',
    description: 'Sprouted moth bean curry topped with fiery Kolhapuri kat/tarri, crunchy farsan, chopped onions, lemon, and 2 soft ladi pavs.',
    categoryId: 'maharashtrian',
    subcategoryId: 'Kolhapuri Misal Pav',
    price: 145,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=600&h=450&fit=crop',
    prepMins: 15,
    variants: [],
    addOnGroups: [],
  },
  {
    id: 'test_prod_goan_fish_curry',
    name: 'Coastal Surmai Fish Curry & Steamed Rice (Test)',
    description: 'Fresh Kingfish steaks simmered in a tangy coconut, kokum, and roasted red chilli coastal gravy served with steamed rice.',
    categoryId: 'bengali-coastal',
    subcategoryId: 'Shorshe Ilish / Fish Curry',
    price: 340,
    foodType: 'non-veg',
    image: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&h=450&fit=crop',
    prepMins: 25,
    variants: [],
    addOnGroups: [],
  },
  {
    id: 'test_prod_punjabi_samosa',
    name: 'Hot Punjabi Aloo Matar Samosa Platter (4 Pcs) (Test)',
    description: 'Golden flaky pastry triangles stuffed with spiced potatoes, green peas & cashews, served with imli-saunth and mint-coriander chutneys.',
    categoryId: 'snacks-pakoras',
    subcategoryId: 'Punjabi Samosa',
    price: 110,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&h=450&fit=crop',
    prepMins: 10,
    variants: [
      { id: 'v_4pcs', name: '4 Pieces Samosa', price: 0 },
      { id: 'v_chole_samosa', name: 'Chole Samosa Chaat (2 pcs)', price: 30 },
    ],
    addOnGroups: [],
  },
  {
    id: 'test_prod_gulab_jamun',
    name: 'Hot Khoya Gulab Jamun & Kesar Rasmalai Duo (Test)',
    description: 'Melt-in-the-mouth khoya dumplings soaked in cardamom-saffron sugar syrup alongside chilled pistachio-studded Kesar Rasmalai.',
    categoryId: 'sweets-mithai',
    subcategoryId: 'Hot Gulab Jamun',
    price: 140,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=450&fit=crop',
    prepMins: 10,
    variants: [
      { id: 'v_gj_2', name: 'Hot Gulab Jamun (2 pcs)', price: 0 },
      { id: 'v_rasmalai_2', name: 'Kesar Rasmalai (2 pcs)', price: 25 },
      { id: 'v_combo_4', name: 'Festive Mithai Box (4 pcs)', price: 90 },
    ],
    addOnGroups: [],
  },
  {
    id: 'test_prod_mango_lassi',
    name: 'Amritsari Peda Sweet Lassi &Kulhad Masala Chai (Test)',
    description: 'Thick churned yogurt lassi topped with malai, rabri, and chopped pistachios in a traditional earthen kulhad.',
    categoryId: 'lassi-beverages',
    subcategoryId: 'Punjabi Sweet Lassi',
    price: 95,
    foodType: 'veg',
    image: 'https://images.unsplash.com/photo-1544145945-f904253d0c7e?w=600&h=450&fit=crop',
    prepMins: 8,
    variants: [
      { id: 'v_sweet_lassi', name: 'Malai Sweet Lassi (350ml)', price: 0 },
      { id: 'v_mango_lassi', name: 'Alphonso Mango Lassi (350ml)', price: 25 },
      { id: 'v_chai_2', name: 'Adrak Elaichi Kulhad Chai (2 Cups)', price: 0 },
    ],
    addOnGroups: [],
  },
];

const SEED_STORAGE_KEY = 'food_india_test_catalog_seeded_v2';

export const seedCategories = async (force = false): Promise<number> => {
  const categoriesRef = collection(db, 'categories');
  const snapshot = await getDocs(categoriesRef);
  const existingIds = new Set(snapshot.docs.map((d) => d.id));

  const batch = writeBatch(db);
  let count = 0;

  INDIAN_FOOD_CATEGORIES.forEach((cat, index) => {
    if (force || !existingIds.has(cat.id)) {
      const ref = doc(categoriesRef, cat.id);
      batch.set(
        ref,
        {
          categoryId: cat.id,
          name: cat.name,
          imagePath: cat.image,
          subcategories: cat.subcategories,
          parentCategoryId: null,
          isGlobal: true,
          restaurantId: null,
          displayOrder: index,
          sortOrder: index + 1,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
  }
  return count;
};

export const ensureDefaultTestRestaurant = async (): Promise<{
  restaurantId: string;
  sellerId: string;
}> => {
  const resRef = doc(db, 'restaurants', DEFAULT_TEST_RESTAURANT_ID);
  const snap = await getDoc(resRef);
  if (!snap.exists()) {
    await setDoc(resRef, {
      restaurantId: DEFAULT_TEST_RESTAURANT_ID,
      sellerId: DEFAULT_TEST_SELLER_ID,
      restaurantName: 'Food India Royal Darbar 🇮🇳 (Test Kitchen)',
      description:
        'Official test kitchen featuring authentic dishes across all 20 Indian food categories — Biryani, North Indian, South Indian, Tandoori, Thalis, Street Chaat, Kashmiri Wazwan, Mithai & more.',
      cuisineTypes: [
        'North Indian',
        'South Indian',
        'Biryani',
        'Street Food',
        'Tandoori',
        'Kashmiri Wazwan',
        'Thalis',
        'Mithai',
      ],
      logoPath: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=200&h=200&fit=crop',
      coverImagePath: 'https://images.unsplash.com/photo-1563379091339-03b17af4a4af?w=900&h=500&fit=crop',
      bannerPath: 'https://images.unsplash.com/photo-1563379091339-03b17af4a4af?w=900&h=500&fit=crop',
      phone: '+91 9876543210',
      email: 'darbar@foodindia.test',
      address: 'Connaught Place, Inner Circle, New Delhi 110001',
      locality: 'New Delhi',
      city: 'New Delhi',
      district: 'Central Delhi',
      state: 'Delhi',
      postalCode: '110001',
      pincode: '110001',
      latitude: 28.6315,
      longitude: 77.2167,
      googleMapsLink: 'https://www.google.com/maps?q=28.6315,77.2167',
      isOpen: true,
      preparationTime: '20-30 mins',
      deliveryPricingMode: 'base_km',
      baseDeliveryCharge: 25,
      deliveryPricePerKm: 8,
      perKmDeliveryCharge: 8,
      maximumDeliveryDistanceKm: 25,
      allowOwnDeliveryStaff: true,
      approvalStatus: 'approved',
      rating: 4.8,
      totalReviews: 128,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  const sellerRef = doc(db, 'sellers', DEFAULT_TEST_SELLER_ID);
  const sellerSnap = await getDoc(sellerRef).catch(() => null);
  if (!sellerSnap || !sellerSnap.exists()) {
    await setDoc(
      sellerRef,
      {
        uid: DEFAULT_TEST_SELLER_ID,
        sellerId: DEFAULT_TEST_SELLER_ID,
        restaurantId: DEFAULT_TEST_RESTAURANT_ID,
        businessName: 'Food India Royal Darbar 🇮🇳 (Test Kitchen)',
        ownerName: 'Royal Darbar Chef (Test Seller)',
        email: 'darbar@foodindia.test',
        phone: '+918825028335',
        businessPhone: '+918825028335',
        verificationStatus: 'verified',
        approvalStatus: 'approved',
        subscriptionStatus: 'active',
        canPublishProducts: true,
        gstEnabled: true,
        gstNumber: '07AABCF9999K1Z5',
        isTestSeller: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch(() => {});
  }

  return {
    restaurantId: DEFAULT_TEST_RESTAURANT_ID,
    sellerId: DEFAULT_TEST_SELLER_ID,
  };
};

export const seedIndianTestProducts = async (options?: {
  sellerId?: string;
  restaurantId?: string;
  force?: boolean;
}): Promise<{ categoriesSeeded: number; productsSeeded: number }> => {
  const force = options?.force ?? false;

  // If this is the automatic startup seed and it already ran once in this browser, don't re-create deleted test products
  if (!force && typeof window !== 'undefined' && localStorage.getItem(SEED_STORAGE_KEY) === 'true') {
    const categoriesSeeded = await seedCategories(false);
    return { categoriesSeeded, productsSeeded: 0 };
  }

  const categoriesSeeded = await seedCategories(true);

  let targetSellerId = options?.sellerId;
  let targetRestaurantId = options?.restaurantId;

  if (!targetSellerId || !targetRestaurantId) {
    const def = await ensureDefaultTestRestaurant();
    targetSellerId = targetSellerId || def.sellerId;
    targetRestaurantId = targetRestaurantId || def.restaurantId;
  }

  const productsRef = collection(db, 'products');
  const existingSnap = await getDocs(productsRef);
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  // If not forced and there are already >= 10 products in Firestore, mark seeded and skip
  if (!force && existingSnap.size >= 10) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEED_STORAGE_KEY, 'true');
    }
    return { categoriesSeeded, productsSeeded: 0 };
  }

  const batch = writeBatch(db);
  let productsSeeded = 0;

  INDIAN_TEST_PRODUCTS.forEach((prod) => {
    const docId =
      options?.sellerId && options.sellerId !== DEFAULT_TEST_SELLER_ID
        ? `${prod.id}_${options.sellerId.slice(0, 6)}`
        : prod.id;

    if (force || !existingIds.has(docId)) {
      const ref = doc(productsRef, docId);
      batch.set(
        ref,
        {
          productId: docId,
          restaurantId: targetRestaurantId,
          sellerId: targetSellerId,
          name: prod.name,
          description: prod.description,
          categoryId: prod.categoryId,
          subcategoryId: prod.subcategoryId,
          price: prod.price,
          basePrice: prod.price,
          foodType: prod.foodType,
          isVeg: prod.foodType === 'veg',
          imagePaths: [prod.image],
          variants: prod.variants,
          addOnGroups: prod.addOnGroups,
          preparationTime: `${prod.prepMins} mins`,
          preparationTimeMinutes: prod.prepMins,
          isAvailable: true,
          isTestProduct: true,
          rating: 4.7,
          reviewCount: 42,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      productsSeeded++;
    }
  });

  if (productsSeeded > 0) {
    await batch.commit();
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(SEED_STORAGE_KEY, 'true');
  }

  return { categoriesSeeded, productsSeeded };
};

export const deleteAllTestProducts = async (sellerIdFilter?: string): Promise<number> => {
  const productsRef = collection(db, 'products');
  const snap = await getDocs(productsRef);
  let deleted = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const isTest =
      Boolean(data.isTestProduct) ||
      d.id.startsWith('test_prod_') ||
      String(data.name || '').toLowerCase().includes('(test)');
    const matchesSeller = !sellerIdFilter || data.sellerId === sellerIdFilter || data.isTestProduct === true;

    if (isTest && matchesSeller) {
      await deleteDoc(doc(db, 'products', d.id));
      deleted++;
    }
  }
  return deleted;
};

export const seedSubscriptionPlans = async () => {
  const plansRef = collection(db, 'subscriptionPlans');

  const plans = [
    {
      planId: 'monthly_499',
      name: 'Seller 30-Day Partner Plan',
      price: 499,
      basePrice: 499,
      gstRate: 18,
      gstAmount: 89.82,
      totalWithGst: 588.82,
      gstNumber: '01BMAPL3192D1CY',
      fssaiLicenseNumber: '11026999000072',
      udyamRegistrationNumber: 'UDYAM-JK-11-0018721',
      parentUnitName: 'KulgamKart',
      parentWebsite: 'kulgamkart.in',
      currency: 'INR',
      durationDays: 30,
      features: [
        'Plan ₹499 + 18% GST (₹89.82) = ₹588.82 for 30 Days (0% Commission)',
        'Official GST Invoice Included (GSTIN: 01BMAPL3192D1CY)',
        'Unlimited Menu Products & Categories',
        '100% Direct COD Orders & Instant Alerts',
        'All-India Delivery Partner Integration',
        'Live GPS Distance Ranking & Reviews',
      ],
    },
  ];

  const batch = writeBatch(db);
  plans.forEach((plan) => {
    const ref = doc(plansRef, plan.planId);
    batch.set(
      ref,
      {
        ...plan,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  // Also ensure official company & compliance details are saved in Admin Profile / Settings
  const officialCompliancePayload = {
    gstNumber: '01BMAPL3192D1CY',
    fssaiLicenseNumber: '11026999000072',
    fssaiDisplayLabel: 'अनुज्ञिप्त संख्या / License Number: 11026999000072',
    parentUnitName: 'KulgamKart',
    parentUnitStatement: 'Food India is a unit of KulgamKart',
    parentWebsite: 'kulgamkart.in',
    udyamRegistrationNumber: 'UDYAM-JK-11-0018721',
    plan499BaseAmount: 499,
    plan499GstRate: 18,
    plan499GstAmount: 89.82,
    plan499TotalAmount: 588.82,
    updatedAt: serverTimestamp(),
  };

  batch.set(doc(db, 'adminSettings', 'global'), officialCompliancePayload, { merge: true });
  batch.set(doc(db, 'adminSettings', 'companyProfile'), officialCompliancePayload, { merge: true });

  await batch.commit();
};

export const cleanAllTestDataFromApp = async (): Promise<void> => {
  try {
    const productsRef = collection(db, 'products');
    const snap = await getDocs(productsRef);
    for (const d of snap.docs) {
      const data = d.data();
      if (
        data.isTestProduct === true ||
        d.id.startsWith('test_prod_') ||
        String(data.name || '').includes('(Test)')
      ) {
        await deleteDoc(doc(db, 'products', d.id)).catch(() => {});
      }
    }

    await deleteDoc(doc(db, 'restaurants', DEFAULT_TEST_RESTAURANT_ID)).catch(() => {});
    await deleteDoc(doc(db, 'sellers', DEFAULT_TEST_SELLER_ID)).catch(() => {});
  } catch (err) {
    console.warn('cleanAllTestDataFromApp non-fatal error:', err);
  }
};

