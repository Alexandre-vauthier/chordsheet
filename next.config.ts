import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin', '@google-cloud/firestore', 'grpc', '@grpc/grpc-js'],
};

export default nextConfig;
