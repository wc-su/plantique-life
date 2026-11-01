import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';

import { migrateGuestCart } from '@/slice/cartSlice';
import Button from './Button';

const RetryMigrateButton = ({ retryToastId }) => {
  const dispatch = useDispatch();
  const isMigrating = useSelector(state => state.cart.isMigrating);

  const retryFailedToastId = 'migrate-cart-retry-failed';

  const handleClick = async () => {
    const response = await dispatch(migrateGuestCart());
    if (migrateGuestCart.rejected.match(response)) {
      toast.error(response.payload.message, { id: retryFailedToastId });
    }
    if (migrateGuestCart.fulfilled.match(response)) {
      if (response.payload) {
        toast.error('加入購物車失敗，請稍後再試', { id: retryFailedToastId });
      } else {
        toast.dismiss(retryToastId);
        toast.dismiss(retryFailedToastId);
        toast.success('加入購物車成功');
      }
    }
  };

  return (
    <Button type="button" variant="outline-danger" disabled={isMigrating} onClick={handleClick}>
      {isMigrating ? '處理中' : '重試'}
    </Button>
  );
};

export default RetryMigrateButton;
