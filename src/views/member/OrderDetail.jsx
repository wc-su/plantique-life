import clsx from 'clsx';
import { Fragment, useCallback, useEffect, useState } from 'react';
import toast, { ErrorIcon } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams } from 'react-router';

import { guestOrderApi, payApi } from '@/api';
import Button from '@/components/Button';
import { INVOICE, PAYMENT } from '@/const/guestConst';
import { addToCarts, fetchCarts } from '@/slice/cartSlice';
import { hideLoading, showLoading } from '@/slice/loadingSlice';
import { getOrderFetchErrorMessage, getPayErrorMessage } from '@/utils/errorMessage';

function OrderDetail() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { state } = useLocation();
  const { orderId } = useParams();

  const userId = useSelector(state => state.guestAuth.user?.id);

  const isFromOrderList = state?.fromOrderList || false;

  const [orderDetail, setOrderDetail] = useState(null);

  // 是否正在新增訂單產品到購物車
  const [addToCartLoading, setAddToCartLoading] = useState(false);
  // 錯誤訊息
  const [loadErrorMessage, setLoadErrorMessage] = useState('');

  // 返回訂單列表
  const handleGoBack = () => {
    if (isFromOrderList) {
      navigate(-1); // 回到上一頁
    } else {
      navigate('/member/orders'); // 回到訂單列表頁
    }
  };

  // 訂單產品加入購物車
  const handleAddToCart = async () => {
    // 取出訂單產品的 id 和 qty
    const products = orderDetail.order_items.map(product => ({
      product_id: product.product_id,
      qty: product.qty,
    }));

    // 新增多筆產品到購物車
    try {
      setAddToCartLoading(true);
      await dispatch(addToCarts({ data: products, preventGlobalLoading: true })).unwrap();
      toast.success('產品加入購物車成功！');

      // 重新取得購物車資訊
      try {
        await dispatch(fetchCarts(true)).unwrap();
      } catch (error) {
        toast.error(error.message);
      }
    } catch {
      toast.error('加入購物車失敗');
    } finally {
      setAddToCartLoading(false);
    }
  };

  // 重新付款
  const processCreditCardPayment = async orderId => {
    try {
      await payApi.payOrder(orderId);
      // 付款成功只會改付款狀態，畫面只更新 is_paid，不重新取得訂單
      setOrderDetail(prev => ({ ...prev, is_paid: true }));
      toast.success('付款成功');
    } catch (error) {
      toast(
        t => (
          <div className="d-flex align-items-center gap-3">
            <ErrorIcon />
            <p>{getPayErrorMessage(error.code === '' ? 'NETWORK_ERROR' : error.code)}</p>
            <Button
              type="button"
              variant="outline-neutral"
              shape="circle"
              size="sm"
              className="border-0"
              onClick={() => toast.dismiss(t.id)}
            >
              <span className="custom-btn-icon material-symbols-rounded">close</span>
            </Button>
          </div>
        ),
        { duration: Infinity },
      );
    }
  };

  const fetchOrderDetail = useCallback(async () => {
    dispatch(showLoading());
    try {
      const data = await guestOrderApi.fetchOrderById(userId, orderId);
      setOrderDetail(data ?? {}); // null 表示不存在
    } catch (error) {
      // 網址的 id 不是 uuid 格式，當成找不到
      if (error.code === '22P02') {
        setOrderDetail({});
        return;
      }
      setLoadErrorMessage(getOrderFetchErrorMessage(error.code === '' ? 'NETWORK_ERROR' : error.code));
    } finally {
      dispatch(hideLoading());
    }
  }, [dispatch, userId, orderId]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  const handleReload = () => {
    setLoadErrorMessage('');
    fetchOrderDetail();
  };

  if (loadErrorMessage) {
    return (
      <div className="text-center py-10">
        <h2 className="fs-7 noto-sans-tc text-neutral-400 text-center">{loadErrorMessage}</h2>
        <Button type="button" variant="filled-primary" shape="pill" size="lg" className="mt-10" onClick={handleReload}>
          重新載入
        </Button>
      </div>
    );
  }

  // 訂單資料正在讀取中
  if (orderDetail === null) {
    return <div className="text-center text-neutral-400 py-10">Loading...</div>;
  }

  // 訂單資料不存在
  if (Object.keys(orderDetail).length === 0) {
    return (
      <div className="text-center py-10">
        <h2 className="fs-7 noto-sans-tc text-neutral-400 text-center">訂單資料不存在</h2>
        <Button type="button" variant="filled-primary" shape="pill" size="lg" className="mt-10" onClick={handleGoBack}>
          返回訂單列表
        </Button>
      </div>
    );
  }

  const discount = orderDetail.total - orderDetail.final_total;

  return (
    <div className="my-8 mt-lg-0 mb-lg-0">
      <div className="d-flex flex-wrap align-items-center mb-lg-6">
        <Button
          onClick={handleGoBack}
          type="button"
          variant="outline-neutral"
          shape="circle"
          size="lg"
          className="border-0"
        >
          <span className="custom-btn-icon material-symbols-rounded">chevron_left</span>
        </Button>
        <Button
          type="button"
          variant="outline-neutral"
          shape="pill"
          size="lg"
          className="order-1 order-lg-2 ms-auto"
          disabled
        >
          申請退貨
        </Button>
        <p className="h6 fs-lg-5 order-2 order-lg-1 w-100 w-lg-auto mt-12 mt-lg-0 ms-lg-2">
          訂單編號：{orderDetail.id}
        </p>
      </div>
      <div className="d-flex align-items-center mb-3 mb-lg-4 pt-5 pt-lg-10">
        <p className="text-neutral-400 fs-sm fs-lg-8">
          付款狀態：
          <span
            className={clsx(
              'fs-xs fs-lg-sm px-3 py-1 ms-1',
              orderDetail.is_paid ? 'bg-primary-100 text-primary' : 'bg-secondary-100 text-secondary',
            )}
          >
            {orderDetail.is_paid ? '已付款' : '未付款'}
          </span>
        </p>
        {orderDetail.payment === PAYMENT.CREDIT_CARD && !orderDetail.is_paid && (
          <Button
            type="button"
            variant="filled-primary"
            shape="pill"
            size="sm"
            className="ms-4"
            onClick={() => processCreditCardPayment(orderDetail.id)}
          >
            重新付款
          </Button>
        )}
      </div>
      <p className="text-neutral-400 fs-sm fs-lg-8 mb-3 mb-lg-4">
        總額：
        <span className="noto-serif-tc fw-bold text-primary-700 ms-1">
          NT${orderDetail.final_total.toLocaleString()}
        </span>
      </p>
      <p className="text-neutral-400 fs-sm fs-lg-8 mb-6 mb-lg-10">
        付款方式：<span className="ms-1">{orderDetail.payment}</span>
      </p>
      {/* 訂購資訊 */}
      <p className="order-detail-spacing mb-6 mb-lg-10">
        <span className="fs-8 fs-lg-7 text-neutral-400">訂購資訊</span>
      </p>
      <p className="fs-sm fs-lg-8 text-neutral-400 mb-3 mb-lg-4">訂購人姓名：{orderDetail.purchaser_name}</p>
      <p className="fs-sm fs-lg-8 text-neutral-400 mb-3 mb-lg-4">訂購人電話：{orderDetail.purchaser_phone}</p>
      <p className="fs-sm fs-lg-8 text-neutral-400 mb-6 mb-lg-10">訂購人電子郵件：{orderDetail.purchaser_email}</p>
      {/* 配送資訊 */}
      <p className="order-detail-spacing mb-6 mb-lg-10">
        <span className="fs-8 fs-lg-7 text-neutral-400">配送資訊</span>
      </p>
      <p className="fs-sm fs-lg-8 text-neutral-400 mb-3 mb-lg-4">配送方式：{orderDetail.delivery}</p>
      <p className="fs-sm fs-lg-8 text-neutral-400 mb-3 mb-lg-4">收件人姓名：{orderDetail.recipient_name}</p>
      <p className="fs-sm fs-lg-8 text-neutral-400 mb-3 mb-lg-4">收件人電話：{orderDetail.recipient_phone}</p>
      <p className="fs-sm fs-lg-8 text-neutral-400 mb-3 mb-lg-4">收件人電子郵件：{orderDetail.recipient_email}</p>
      <p className="fs-sm fs-lg-8 text-neutral-400 mb-6 mb-lg-10">收件人地址：{orderDetail.recipient_address}</p>
      {/* 商品資訊 */}
      <p className="order-detail-spacing mb-6 mb-lg-10">
        <span className="fs-8 fs-lg-7 text-neutral-400">商品資訊</span>
      </p>
      <div className="row mb-6 mb-lg-10 gy-6">
        {orderDetail.order_items.map(product => (
          <Fragment key={product.id}>
            <div className="col-6 col-lg-3">
              <img
                src={product.image_url}
                alt={product.title}
                className="order-detail-product-img img-fluid w-100 object-fit-cover"
              />
            </div>
            <div className="col-6 col-lg-9">
              <div className="row flex-column flex-lg-row justify-content-center align-items-lg-center h-100">
                <div className="col-lg-6 mb-3 mb-lg-0">
                  <p className="h6 fs-lg-5 text-neutral-700 mb-lg-2">{product.title}</p>
                  <div className="d-flex align-items-center">
                    <p className="fs-8 fs-lg-7 noto-serif-tc fw-bold text-primary-700">
                      NT${product.price.toLocaleString()}
                    </p>
                    {product.origin_price > product.price && (
                      <del className="fs-sm fs-lg-8 noto-serif-tc fw-bold text-neutral-400 ms-1">
                        ${product.origin_price.toLocaleString()}
                      </del>
                    )}
                  </div>
                </div>
                <div className="col-lg-2 mb-3 mb-lg-0">
                  <p className="fs-sm fs-lg-8 text-neutral-400">x {product.qty}</p>
                </div>
                <div className="col-lg-4 align-content-end">
                  <p className="fs-7 fs-lg-6 noto-serif-tc fw-bold text-primary-700 text-lg-end">
                    NT${(product.price * product.qty).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </Fragment>
        ))}
      </div>
      {/* 優惠券、運費、訂單總金額 */}
      <div className="border-top py-6 py-lg-10">
        <div className="d-flex align-items-center mb-3 mb-lg-4">
          <span className="fs-sm fs-lg-8 text-neutral-400">優惠券：</span>
          {orderDetail.coupon_title && (
            <span className="fs-xs fs-lg-sm bg-secondary-100 text-secondary px-2 py-1 ms-1">
              {orderDetail.coupon_title}
            </span>
          )}
          <span className="fs-sm fs-lg-8 noto-serif-tc fw-bold text-primary-700 ms-auto">
            {discount > 0 && '-'} NT${discount.toLocaleString()}
          </span>
        </div>
        <div className="d-flex justify-content-between mb-5 mb-lg-6">
          <span className="fs-sm fs-lg-8 text-neutral-400">運費：</span>
          <span className="fs-sm fs-lg-8 noto-serif-tc fw-bold text-primary-700">
            NT$0<del className="fs-xs fs-lg-sm text-neutral-400 ms-1">$120</del>
          </span>
        </div>
        <div className="d-flex justify-content-between">
          <span className="h6 fs-lg-5">訂單總金額</span>
          <span className="h6 fs-lg-5">NT${orderDetail.final_total.toLocaleString()}</span>
        </div>
      </div>
      {/* 發票資訊 */}
      <div className="border-top py-6 py-lg-10">
        <p className="fs-sm fs-lg-8 text-neutral-400 mb-3 mb-lg-4">發票種類：{orderDetail.invoice}</p>
        {orderDetail.invoice === INVOICE.MOBILE_BARCODE && (
          <p className="fs-sm fs-lg-8 text-neutral-400">手機條碼：{orderDetail.mobile_barcode}</p>
        )}
        {orderDetail.invoice === INVOICE.UBN && (
          <p className="fs-sm fs-lg-8 text-neutral-400">統一編號：{orderDetail.ubn}</p>
        )}
      </div>
      {/* 再買一次按鈕 */}
      <div className="text-center mt-lg-6">
        <Button
          variant="filled-primary"
          shape="pill"
          size="lg"
          leftIcon={!addToCartLoading}
          iconName="shopping_cart"
          className="d-inline-flex"
          onClick={handleAddToCart}
          disabled={addToCartLoading}
        >
          {addToCartLoading ? (
            <div className="d-flex align-items-center justify-content-center">
              <div className="spinner-border spinner-border-sm text-white" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="ms-2">加入購物車中...</span>
            </div>
          ) : (
            '再買一次'
          )}
        </Button>
      </div>
    </div>
  );
}

export default OrderDetail;
