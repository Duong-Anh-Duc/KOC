import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dxkcpaifl',
  api_key: process.env.CLOUDINARY_API_KEY || '497232233968419',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'Wvm_UvWUCKJr5BHOXMtNVr13dbU',
});

export default cloudinary;
