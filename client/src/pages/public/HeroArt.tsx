import { useRef } from 'react';
import { cx } from '../../lib/cx';
import { useInViewOnce } from '../../lib/useInViewOnce';
import styles from './HeroArt.module.css';

/**
 * The hero illustration (résumé, paper plane, watching eye), drawn inline so its parts can move. When it
 * first comes into view, the plane flies in along its trail ("after you hit send"), then the eye blinks
 * once ("someone is reading"). It plays once and then stays still. Decorative: hidden from screen readers.
 */
export function HeroArt({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const play = useInViewOnce(ref, 0.6);

  return (
    <svg
      ref={ref}
      className={cx(className, play ? styles.play : styles.waiting)}
      width="300"
      height="306"
      viewBox="0 0 300 306"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M151 260C208.99 260 256 212.99 256 155C256 97.0101 208.99 50 151 50C93.0101 50 46 97.0101 46 155C46 212.99 93.0101 260 151 260Z"
        fill="#E3F1ED"
      />
      {/* The plane's dotted flight trail. */}
      <path
        className={styles.trail}
        d="M45 94C24 114 34 143 54 142C73 141 73 120 59 122C44 124 44 154 67 168"
        stroke="#176B58"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <path d="M247 66C249 76 251 78 260 80C251 82 249 84 247 94C245 84 243 82 234 80C243 78 245 76 247 66Z" fill="#176B58" />
      <path d="M68 229C69 236 71 238 78 239C71 240 69 242 68 249C67 242 65 240 58 239C65 238 67 236 68 229Z" fill="#176B58" />

      {/* The résumé: shadow, page, photo, text lines. */}
      <path
        d="M201.079 57.4507L94.877 70.4907C89.9435 71.0965 86.4352 75.587 87.0409 80.5205L106.906 242.305C107.511 247.239 112.002 250.747 116.935 250.142L223.138 237.102C228.071 236.496 231.58 232.005 230.974 227.072L211.109 65.2868C210.503 60.3533 206.013 56.845 201.079 57.4507Z"
        fill="#176B58"
      />
      <path
        d="M195.385 52.1048L89.183 65.1448C84.2495 65.7506 80.7412 70.241 81.3469 75.1746L101.212 236.96C101.817 241.893 106.308 245.401 111.241 244.796L217.444 231.756C222.377 231.15 225.886 226.659 225.28 221.726L205.415 59.9409C204.809 55.0074 200.319 51.499 195.385 52.1048Z"
        fill="white"
        stroke="#105442"
        strokeWidth="2.5"
      />
      <path
        d="M115.006 111.342C124.324 110.198 130.951 101.716 129.807 92.3971C128.663 83.0783 120.181 76.4514 110.862 77.5956C101.543 78.7398 94.9163 87.2218 96.0605 96.5407C97.2048 105.86 105.687 112.486 115.006 111.342Z"
        fill="#E3F1ED"
        stroke="#176B58"
        strokeWidth="2"
      />
      <path
        d="M113.056 95.4614C115.797 95.1249 117.746 92.6302 117.409 89.8894C117.073 87.1485 114.578 85.1994 111.837 85.536C109.096 85.8725 107.147 88.3672 107.484 91.1081C107.82 93.8489 110.315 95.798 113.056 95.4614Z"
        fill="#176B58"
      />
      <path
        d="M103.234 105.735C103.496 99.6578 107.222 97.1852 113.178 96.454C119.133 95.7228 123.347 97.2204 125.07 103.054C119.846 109.74 109.921 110.959 103.234 105.735Z"
        fill="#176B58"
      />
      <path
        d="M139.872 84.1087L185.529 78.5027M141.091 94.0342L173.845 90.0125"
        stroke="#105442"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M104.923 127.693L194.252 116.725" stroke="#176B58" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M106.751 142.581L143.475 138.072M112.113 186.253L148.838 181.744"
        stroke="#105442"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M108.214 154.492L193.572 144.011M109.432 164.417L182.881 155.399M113.576 198.164L194.965 188.17M114.794 208.089L181.295 199.924M116.013 218.014L158.693 212.774"
        stroke="#176B58"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* The eye: shadow, outline, white, iris, pupil, highlight. Blinks as one group. */}
      <g className={styles.eye}>
        <path
          d="M147 223C166 196 191 185 214 188C240 190 261 204 278 224C261 247 239 260 215 260C188 260 165 247 147 223Z"
          fill="#E3F1ED"
        />
        <path
          d="M146 216C165 191 189 180 213 182C239 184 260 199 277 218C258 241 237 253 213 252C187 251 164 238 146 216Z"
          fill="#176B58"
          stroke="#105442"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M160 216C177 200 195 191 213 192C233 193 251 203 263 218C249 233 233 243 213 242C193 241 175 231 160 216Z"
          fill="white"
        />
        <path
          d="M213 241C226.255 241 237 230.255 237 217C237 203.745 226.255 193 213 193C199.745 193 189 203.745 189 217C189 230.255 199.745 241 213 241Z"
          fill="#E3F1ED"
          stroke="#105442"
          strokeWidth="2.5"
        />
        <path
          d="M213 229C219.627 229 225 223.627 225 217C225 210.373 219.627 205 213 205C206.373 205 201 210.373 201 217C201 223.627 206.373 229 213 229Z"
          fill="#105442"
        />
        <path
          d="M218 215C220.209 215 222 213.209 222 211C222 208.791 220.209 207 218 207C215.791 207 214 208.791 214 211C214 213.209 215.791 215 218 215Z"
          fill="white"
        />
      </g>

      {/* The paper plane. */}
      <g className={styles.plane}>
        <path d="M31 66L83 46L68 93L54 77L31 66Z" fill="#D9402B" stroke="#105442" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M83 46L54 77L51 89L60 84" stroke="#105442" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
