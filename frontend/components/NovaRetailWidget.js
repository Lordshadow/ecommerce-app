'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const gatewayBase = (process.env.NEXT_PUBLIC_NOVARETAIL_GATEWAY_URL || 'http://localhost:8000').replace(/\/$/, '');
const tenant = process.env.NEXT_PUBLIC_NOVARETAIL_TENANT || 'ApexStore';
const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const scriptId = 'novaretail-support-widget';

export default function NovaRetailWidget() {
  const pathname = usePathname();

  useEffect(() => {
    if (!gatewayBase || typeof window === 'undefined') return;

    window.getApexCustomerToken = async () => {
      try {
        const response = await fetch(`${apiBase}/api/auth/me`, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });
        if (!response.ok) return null;
        const data = await response.json();
        if (data.user?.id) window.__apex_customer_id = String(data.user.id);
        else delete window.__apex_customer_id;
        return data.customer_token || null;
      } catch {
        return null;
      }
    };

    const productMatch = pathname?.match(/^\/product\/([^/]+)/);
    const productId = productMatch ? decodeURIComponent(productMatch[1]) : '';
    let script = document.getElementById(scriptId);
    const loadedProductId = script?.dataset.productId || '';
    if (script && loadedProductId !== productId) {
      script.remove();
      document.getElementById('novaretail-support-widget-host')?.remove();
      script = null;
    }
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `${gatewayBase}/widget/v1/widget.js`;
      script.defer = true;
    }
    script.dataset.tenant = tenant;
    script.dataset.apiBase = gatewayBase;
    script.dataset.productId = productId;
    script.dataset.getToken = 'getApexCustomerToken';
    if (!script.isConnected) document.body.appendChild(script);
  }, [pathname]);

  return null;
}
