import Link from "next/link";

export default function Home() {
  return (
    <div>
      Hi Worlds.{" "}
      <Link href="/about">
        About
      </Link>
    </div>
  );
}
