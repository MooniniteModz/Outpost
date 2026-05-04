import KallixIcon from '../assets/Kallix-Production-Pack/logo/Kallix-Logo-Icon.svg';

export default function KallixLogo({ size = 32 }) {
  return (
    <img
      src={KallixIcon}
      width={size}
      height={size}
      alt="Kallix"
      style={{ objectFit: 'contain', display: 'block' }}
    />
  );
}
