import React from 'react';
import { ArrowUpRight, Check, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { ProductImage } from './ProductImage';
import { WishlistButton } from './WishlistButton';
import { useApp } from '../context/AppContext';

interface ProductCardProps { product: Product; variant?: 'grid' | 'list' | 'compact'; }

export const ProductCard: React.FC<ProductCardProps> = ({ product, variant = 'grid' }) => {
  const { navigate, addToCart, cartItems } = useApp();
  const isInCart = cartItems.some(item => item.product.id === product.id);
  const [name, subtitle] = product.title.split(' — ');
  const details = () => navigate('/product/:slug', { slug: product.slug });
  return (
    <article id={`product-card-${product.id}`} className={`studio-product-card ${variant === 'list' ? 'product-list' : ''}`}>
      <div className={`product-visual product-visual-${product.id}`}>
        <button className="product-image-link" onClick={details} aria-label={`View ${product.title}`}><ProductImage product={product} className="studio-product-image" /><span className="image-hover-label">Explore template <ArrowUpRight size={16} /></span></button>
        <span className="product-category">{product.tags[0] || product.categoryLabel}</span>
        <div className="product-wishlist"><WishlistButton product={product} size="sm" /></div>
      </div>
      <div className="product-content"><div className="product-title-row"><h3><button onClick={details}>{name}</button></h3><span className="product-format">{product.fileFormat?.includes('React') ? 'React' : product.fileFormat?.includes('HTML') ? 'HTML / CSS' : product.categoryLabel}</span></div><p className="product-subtitle">{subtitle || product.categoryLabel}</p><p className="product-description">{product.shortDescription}</p>
        <div className="product-bottom"><div className="product-price">₹{product.price.toLocaleString('en-IN')}{product.originalPrice && product.originalPrice > product.price && <del>₹{product.originalPrice.toLocaleString('en-IN')}</del>}<small>One-time payment</small></div><div className="product-card-actions"><button className="product-cart" onClick={() => { if (isInCart) navigate('/cart'); else addToCart(product, 1); }} aria-label={isInCart ? `View ${name} in cart` : `Add ${name} to cart`}>{isInCart ? <Check size={17} /> : <ShoppingBag size={17} />}</button><button className="product-details" onClick={details}>View details <ArrowUpRight size={15} /></button></div></div>
      </div>
    </article>
  );
};
