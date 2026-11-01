import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';

import Button from '@/components/Button';
import RetryMigrateButton from '@/components/RetryMigrateButton';
import { migrateGuestCart } from '@/slice/cartSlice';

export function useMigrateGuestCart() {
  const dispatch = useDispatch();

  const showFailedToast = () => {
    toast(
      t => (
        <div className="d-flex align-items-start">
          <div className="p-2">
            <span className="material-symbols-rounded fs-4 text-secondary">warning</span>
          </div>
          <div className="d-flex flex-column p-2 pe-0">
            <p className="mb-3">登入前加入的商品還沒放進購物車</p>
            <div className="align-self-end">
              <RetryMigrateButton retryToastId={t.id} />
            </div>
          </div>
          <Button type="button" className="p-2" onClick={() => toast.dismiss(t.id)} aria-label="關閉">
            <span className="text-neutral-400 material-symbols-rounded d-block"> close </span>
          </Button>
        </div>
      ),
      {
        style: {
          background: '#fbf3d5', // 淺黃色背景
        },
        duration: Infinity,
        id: 'migrate-cart-failed',
      },
    );
  };

  return async () => {
    // localStorage 資訊加入購物車
    const result = await dispatch(migrateGuestCart());
    if (migrateGuestCart.rejected.match(result)) {
      if (result.payload.isMigrateError) {
        showFailedToast();
      } else {
        toast.error(result.payload.message);
      }
    }
    if (migrateGuestCart.fulfilled.match(result) && result.payload) {
      showFailedToast();
    }
  };
}
