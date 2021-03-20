import React from "react";
import { PageHeader } from "antd";

// displays a page header

export default function Header() {
  return (
    <a href="https://github.com/WhaleShow/nft-hack" target="_blank" rel="noopener noreferrer">
      <PageHeader
        title="🐳 WhaleShow"
        subTitle=""
        style={{ cursor: "pointer" }}
      />
    </a>
  );
}
