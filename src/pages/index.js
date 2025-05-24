import Link from "next/link";

export default function Home() {
  return (
    <div>
      Hello Worlds.{" "}
      <Link href="/about">
        About
      </Link>
    </div>
  );
}
