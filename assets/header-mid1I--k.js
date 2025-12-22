(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))s(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const c of t.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&s(c)}).observe(document,{childList:!0,subtree:!0});function a(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?t.credentials="include":e.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function s(e){if(e.ep)return;e.ep=!0;const t=a(e);fetch(e.href,t)}})();const p="/plantique-life/assets/img_product_11-WY76kbCO.png",f="/plantique-life/assets/img_product_13-ByJQwkSE.png",b="/plantique-life/assets/img_product_add_01-D4A3_wI3.png",g=[{source:f,name:"荒原綠影"},{source:p,name:"垂綠星河"},{source:b,name:"噴霧器",position:"product-add1-position"}],r=[{type:"product",name:"荒原綠影",originalPrice:2400,salePrice:2400,count:1},{type:"product",name:"垂綠星河",originalPrice:3600,salePrice:3600,count:1},{type:"add-on",name:"噴霧器",originalPrice:249,salePrice:129,count:1}];function d(n,o,a,s){n.innerHTML="";const e=document.createDocumentFragment();if(o.length===0){const t=document.createElement("li");t.classList.add("text-center","py-5","text-neutral-500"),t.textContent="購物車尚未加入商品",e.appendChild(t),s.disabled=!0}else o.forEach((t,c)=>e.appendChild(y(t,c))),s.disabled=!1;a.textContent=o.length,n.appendChild(e)}function y(n,o){const a=document.createElement("li");a.dataset.index=o;const s=g.filter(e=>e.name===n.name);return a.innerHTML=`
      <div class="card border-0 flex-row">
        <img src="${s?s[0].source:""}" class="card-img-top w-25 rounded-0 object-fit-cover" alt="${n.name}">
        <div class="card-body d-flex flex-column p-0 ms-3">
          ${n.type==="add-on"?'<span class="align-self-start d-inline-block fs-xs text-secondary bg-secondary-100 text-nowrap py-1 px-2 px-lg-3 mb-1">加購商品</span>':""}
          <p class="card-title fs-6 noto-serif-tc fw-bold text-neutral-700 mb-1">${n.name}</p>
          <div class="d-flex align-items-center mb-1">
            <p class="card-text text-neutral-700 noto-serif-tc fw-bold me-1">NT$${n.salePrice.toLocaleString()}</p>
            ${n.salePrice===n.originalPrice?"":`<p class="card-text fs-sm text-neutral-400 noto-serif-tc fw-bold text-decoration-line-through">$${n.originalPrice.toLocaleString()}</p>`}
          </div>
          <div class="d-flex align-items-center mt-auto">
            <button class="btn custom-btn-outline-neutral custom-btn-circle-sm p-1 me-1" data-action="minus" type="button" disabled>
              <span class="custom-btn-icon material-symbols-rounded">remove</span>
            </button>
            <div class="text-center">
              <span class="px-2 me-1" data-action="quantity">1</span>
            </div>
            <button class="btn custom-btn-outline-neutral custom-btn-circle-sm p-1 me-1" data-action="add" type="button">
              <span class="custom-btn-icon material-symbols-rounded">add</span>
            </button>
            <button class="btn custom-btn-outline-danger custom-btn-circle-sm p-1 ms-auto" data-action="delete" type="button">
              <span class="custom-btn-icon material-symbols-rounded">delete</span>
            </button>
          </div>
        </div>
      </div>`,a}const l=document.getElementById("header-offcanvas-cart"),u=document.getElementById("header-offcanvas-text"),i=document.querySelector('[data-id="headerGoCartBtn"]');d(l,r,u,i);l.addEventListener("click",n=>{const o=n.target.closest("button");if(!o)return;const a=o.closest("li"),s=a.querySelector('[data-action="quantity"]'),e=r[a.dataset.index];switch(o.dataset.action){case"add":e.count++,s.textContent=e.count;const c=a.querySelector('[data-action="minus"]');c.disabled=!1;break;case"minus":e.count>1&&(e.count--,s.textContent=e.count),e.count<=1&&(o.disabled=!0);break;case"delete":r.splice(r.findIndex(m=>m.name===e.name),1),d(n.currentTarget,r,u,i);break;default:return}});i.addEventListener("click",()=>window.location.href="./shopping-cart.html");
