"use client";

import { useMemo, useState } from "react";

import { addCartItem, requestCartDrawerOpen } from "../../lib/cart-client.js";
import { formatGbp } from "../../lib/format.js";

function resolveOptions(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const colours = Array.from(new Set(variants.map((entry) => entry.colourName).filter(Boolean)));
  const sizes = Array.from(new Set(variants.map((entry) => entry.sizeName).filter(Boolean)));
  return {
    colours: colours.length ? colours : ["Default"],
    sizes: sizes.length ? sizes : ["One Size"]
  };
}

export default function ProductDetail({ product }) {
  const options = useMemo(() => resolveOptions(product), [product]);
  const [selectedColour, setSelectedColour] = useState(options.colours[0]);
  const [selectedSize, setSelectedSize] = useState(options.sizes[0]);

  const activeImage =
    product.images?.find((entry) => entry.colourName === selectedColour)?.imageUrl ||
    product.heroImageUrl ||
    "/mock/placeholder-tee.svg";
  const selectedVariant =
    product.variants?.find(
      (entry) => entry.colourName === selectedColour && entry.sizeName === selectedSize
    ) || product.variants?.[0];

  function handleAddToCart() {
    addCartItem({
      id: `cart_${product.id}_${selectedVariant?.id || "default"}`,
      productId: product.id,
      variantId: selectedVariant?.id || `${product.id}_default`,
      title: product.title,
      colourName: selectedColour,
      sizeName: selectedSize,
      priceGbp: product.priceGbp,
      quantity: 1,
      imageUrl: activeImage
    });
    requestCartDrawerOpen();
  }

  return (
    <div className="pg-product-detail">
      <div className="pg-product-gallery">
        <div className="pg-product-gallery-main">
          <img src={activeImage} alt={product.title} className="pg-product-detail-image" />
        </div>
        <div className="pg-product-gallery-strip">
          {(product.images || []).slice(0, 6).map((image) => (
            <button
              key={image.id}
              type="button"
              className={`pg-thumb-button${image.colourName === selectedColour ? " is-active" : ""}`}
              onClick={() => setSelectedColour(image.colourName)}
            >
              <img src={image.imageUrl} alt={`${product.title} ${image.colourName}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="pg-product-detail-copy">
        <p className="pg-kicker">Generated Product</p>
        <h1>{product.title}</h1>
        <div className="pg-product-price-large">{formatGbp(product.priceGbp)}</div>
        <p className="pg-product-description">{product.description}</p>

        <div className="pg-selector-group">
          <label htmlFor="product-colour">Colour</label>
          <select id="product-colour" value={selectedColour} onChange={(event) => setSelectedColour(event.target.value)}>
            {options.colours.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="pg-selector-group">
          <label htmlFor="product-size">Size</label>
          <select id="product-size" value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
            {options.sizes.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <button type="button" className="pg-primary-button" onClick={handleAddToCart}>
          ADD TO CART
        </button>
      </div>
    </div>
  );
}
