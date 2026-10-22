import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Plus, X, Upload, Info, AlertCircle, Check, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { productService } from '../services/products';
import { Product, Category, AddOnGroup, ProductVariant, AddOnOption } from '../models/types';
import { doc, getDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { motion, AnimatePresence } from 'framer-motion';

const EditProduct: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    categoryId: '',
    subcategoryId: '',
    price: '',
    foodType: 'veg' as 'veg' | 'non-veg' | 'egg',
    preparationTime: '20',
    isAvailable: true,
  });
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [addOnGroups, setAddOnGroups] = useState<AddOnGroup[]>([]);

  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!user || !productId) return;
      
      // 1. Fetch Categories
      const catSnap = await getDocs(collection(db, 'categories'));
      const catList = catSnap.docs
        .map(d => ({ ...d.data(), categoryId: d.id } as Category))
        .filter(c => c.isActive !== false)
        .sort((a, b) => (a.displayOrder ?? a.sortOrder ?? 999) - (b.displayOrder ?? b.sortOrder ?? 999));
      setCategories(catList);

      // 2. Fetch Product
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        const data = productDoc.data() as Product;
        if (data.sellerId !== user.uid) {
          setErrorBanner('You do not have permission to edit this product.');
          navigate('/seller');
          return;
        }
        setProduct(data);
        const prepMins = data.preparationTimeMinutes || parseInt(String(data.preparationTime || '20')) || 20;
        setFormData({
          name: data.name,
          description: data.description || '',
          categoryId: data.categoryId,
          subcategoryId: data.subcategoryId || '',
          price: data.price.toString(),
          foodType: data.foodType || (data.isVeg ? 'veg' : 'non-veg'),
          preparationTime: String(prepMins),
          isAvailable: data.isAvailable !== false,
        });
        setExistingImages(data.imagePaths || []);
        setVariants(data.variants || []);
        setAddOnGroups(data.addOnGroups || []);
      } else {
        setErrorBanner('Product not found.');
        navigate('/seller');
      }
      setLoading(false);
    };
    init();
  }, [user, productId, navigate]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setNewImageFiles(prev => [...prev, ...files].slice(0, 5 - existingImages.length));
    }
  };

  const removeExistingImage = (url: string) => {
    setExistingImages(existingImages.filter(i => i !== url));
  };

  const removeNewImage = (index: number) => {
    setNewImageFiles(newImageFiles.filter((_, i) => i !== index));
  };

  const addVariant = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setVariants([...variants, { id, name: '', price: 0 }]);
  };

  const updateVariant = (id: string, field: keyof ProductVariant, value: string | number) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const addAddOnGroup = () => {
    const id = Math.random().toString(36).substr(2, 9);
    setAddOnGroups([...addOnGroups, { 
      id, 
      name: '', 
      options: [{ name: '', price: 0 }], 
      isRequired: false, 
      minSelections: 0, 
      maxSelections: 1 
    }]);
  };

  const updateAddOnGroup = (id: string, field: keyof AddOnGroup, value: any) => {
    setAddOnGroups(addOnGroups.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  const addOptionToGroup = (groupId: string) => {
    setAddOnGroups(addOnGroups.map(g => g.id === groupId ? { ...g, options: [...g.options, { name: '', price: 0 }] } : g));
  };

  const updateOption = (groupId: string, optionIndex: number, field: keyof AddOnOption, value: string | number) => {
    setAddOnGroups(addOnGroups.map(g => {
      if (g.id === groupId) {
        const newOptions = [...g.options];
        newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value };
        return { ...g, options: newOptions };
      }
      return g;
    }));
  };

  const removeAddOnGroup = (id: string) => {
    setAddOnGroups(addOnGroups.filter(g => g.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !productId) return;

    setSaving(true);
    setErrorBanner(null);
    try {
      const prepMins = parseInt(formData.preparationTime) || 20;
      const updates: Partial<Product> = {
        ...formData,
        price: parseFloat(formData.price),
        preparationTime: `${prepMins} mins`,
        preparationTimeMinutes: prepMins,
        isVeg: formData.foodType === 'veg',
        variants: variants.map(v => ({ ...v, price: Number(v.price || 0) })),
        addOnGroups: addOnGroups.map(g => ({
          ...g,
          maxSelections: Number(g.maxSelections || 1),
          options: g.options.map(o => ({ ...o, price: Number(o.price || 0) }))
        })),
        imagePaths: existingImages, // Service will append new ones
      };

      await productService.updateProduct(productId, updates, newImageFiles);
      navigate('/seller');
    } catch (error: any) {
      console.error('Error updating product:', error);
      setErrorBanner(error?.message || 'Failed to update product.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <header className="bg-white px-6 py-6 border-b border-slate-100 sticky top-0 z-50 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-900 active:scale-90 transition-transform"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>
          <h1 className="text-xl font-black text-slate-900">Edit Product</h1>
        </div>
        {productId && (
          <button
            type="button"
            onClick={async () => {
              await productService.deleteProduct(productId);
              navigate('/seller');
            }}
            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
          >
            <Trash2 size={15} />
            <span>Delete Product</span>
          </button>
        )}
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        {errorBanner && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold">
            <AlertCircle size={18} />
            <span>{errorBanner}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Availability Toggle */}
          <section className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${formData.isAvailable ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                <Check size={24} strokeWidth={3} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Available for Order</h3>
                <p className="text-xs text-slate-400 font-medium">Turn off to temporarily hide from menu</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setFormData({...formData, isAvailable: !formData.isAvailable})}
              className={`w-14 h-8 rounded-full relative transition-colors ${formData.isAvailable ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.isAvailable ? 'right-1' : 'left-1'}`} />
            </button>
          </section>

          {/* Images Section */}
          <section className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Product Images ({existingImages.length + newImageFiles.length}/5)</h3>
            <div className="grid grid-cols-3 gap-4">
              {existingImages.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-slate-100 group">
                  <img src={url} alt="product" className="w-full h-full object-cover" />
                  <button 
                    type="button"
                    onClick={() => removeExistingImage(url)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                </div>
              ))}
              {newImageFiles.map((file, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden bg-orange-50 border-2 border-orange-200 group">
                  <img src={URL.createObjectURL(file)} alt="new preview" className="w-full h-full object-cover opacity-60" />
                  <button 
                    type="button"
                    onClick={() => removeNewImage(idx)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[8px] font-black text-orange-600 bg-white/90 px-2 py-1 rounded-full uppercase">New</span>
                  </div>
                </div>
              ))}
              {existingImages.length + newImageFiles.length < 5 && (
                <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-all group">
                  <Upload size={24} className="text-slate-400 group-hover:text-orange-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-orange-600">Upload</span>
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </section>

          {/* Basic Info */}
          <section className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">General Information</h3>
            
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Product Name</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full h-14 px-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 font-medium transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">Description</label>
              <textarea 
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 font-medium transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Category</label>
                <select 
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
                  className="w-full h-14 px-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 font-medium transition-colors appearance-none"
                >
                  <option value="">Select</option>
                  {categories.map(c => (
                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Base Price (₹)</label>
                <input 
                  type="number" 
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="w-full h-14 px-5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:border-orange-500 font-medium transition-colors"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 ml-1">Food Type</label>
              <div className="flex gap-3">
                {['veg', 'non-veg', 'egg'].map(type => (
                  <button 
                    key={type}
                    type="button"
                    onClick={() => setFormData({...formData, foodType: type as any})}
                    className={`flex-1 h-12 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${formData.foodType === type ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-100 text-slate-400 bg-white'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Variants Section */}
          <section className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Variants (Sizes/Portions)</h3>
              <button 
                type="button"
                onClick={addVariant}
                className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center hover:bg-orange-100 transition-colors"
              >
                <Plus size={18} strokeWidth={3} />
              </button>
            </div>
            
            <div className="space-y-4">
              {variants.map((v) => (
                <div key={v.id} className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Size" 
                    value={v.name}
                    onChange={(e) => updateVariant(v.id, 'name', e.target.value)}
                    className="flex-1 h-12 px-4 bg-slate-50 rounded-xl border border-slate-100 text-sm font-bold focus:border-orange-500 outline-none"
                  />
                  <input 
                    type="number" 
                    placeholder="Price" 
                    value={v.price || ''}
                    onChange={(e) => updateVariant(v.id, 'price', parseFloat(e.target.value))}
                    className="w-24 h-12 px-4 bg-slate-50 rounded-xl border border-slate-100 text-sm font-black focus:border-orange-500 outline-none"
                  />
                  <button 
                    type="button"
                    onClick={() => removeVariant(v.id)}
                    className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Add-on Groups */}
          <section className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Add-on Groups</h3>
              <button 
                type="button"
                onClick={addAddOnGroup}
                className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center hover:bg-orange-100 transition-colors"
              >
                <Plus size={18} strokeWidth={3} />
              </button>
            </div>

            <div className="space-y-8">
              {addOnGroups.map((g) => (
                <div key={g.id} className="p-6 bg-slate-50 rounded-3xl space-y-4 relative">
                  <button 
                    type="button"
                    onClick={() => removeAddOnGroup(g.id)}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-white text-red-500 rounded-full shadow-md flex items-center justify-center"
                  >
                    <X size={16} />
                  </button>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Group Name" 
                      value={g.name}
                      onChange={(e) => updateAddOnGroup(g.id, 'name', e.target.value)}
                      className="col-span-2 h-12 px-4 bg-white rounded-xl border border-slate-200 font-bold focus:border-orange-500 outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={g.isRequired}
                        onChange={(e) => updateAddOnGroup(g.id, 'isRequired', e.target.checked)}
                        className="w-5 h-5 accent-orange-600"
                      />
                      <span className="text-xs font-bold text-slate-600">Required</span>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Options</span>
                      <button 
                        type="button"
                        onClick={() => addOptionToGroup(g.id)}
                        className="text-[10px] font-black text-orange-600 uppercase"
                      >
                        + Add Option
                      </button>
                    </div>
                    {g.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex gap-3">
                        <input 
                          type="text" 
                          placeholder="Option Name" 
                          value={opt.name}
                          onChange={(e) => updateOption(g.id, optIdx, 'name', e.target.value)}
                          className="flex-1 h-10 px-4 bg-white rounded-lg border border-slate-200 text-xs font-bold focus:border-orange-500 outline-none"
                        />
                        <input 
                          type="number" 
                          placeholder="Price" 
                          value={opt.price || ''}
                          onChange={(e) => updateOption(g.id, optIdx, 'price', parseFloat(e.target.value))}
                          className="w-20 h-10 px-4 bg-white rounded-lg border border-slate-200 text-xs font-black focus:border-orange-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button 
            type="submit"
            disabled={saving}
            className="w-full h-16 bg-slate-900 text-white rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {saving ? 'UPDATING DISH...' : 'UPDATE PRODUCT'}
          </button>
        </form>
      </main>
    </div>
  );
};

export default EditProduct;
