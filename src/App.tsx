import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './index.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

interface WindowWithLeaflet extends Window {
  L?: typeof L & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markerClusterGroup?: () => any;
  };
}

interface ChargeRow {
  metro: string;
  city: string;
  stnPlace: string;
  stnAddr: string;
  rapidCnt: number;
  slowCnt: number;
  carType: string;
  lng?: number;
  lat?: number;
}

const RedIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [realData, setRealData] = useState<ChargeRow[]>([]);
  const [isClusterReady, setIsClusterReady] = useState(false);
  const [statusMsg, setStatusMsg] = useState("데이터 로드 준비 중...");

  const getCoords = async (address: string) => {
    const VWORLD_KEY = '3C8C1ABF-FF9C-3723-83CB-B2B24AF0737D';
    
    const cleanAddr = address.split('(')[0].split(',')[0].replace(/빌딩|아파트|상가/g, '').trim();

    const tryFetch = async (addr: string, type: 'road' | 'parcel') => {
      const params = new URLSearchParams({
        service: 'address',
        request: 'getcoord',
        version: '2.0',
        crs: 'epsg:4326',
        address: addr,
        refine: 'true',
        simple: 'false',
        format: 'json',
        type: type,
        key: VWORLD_KEY
      });

      try {
        const response = await fetch(`/vworld.kr/req/address?${params.toString()}`);
        const data = await response.json();
        if (data.response?.status === 'OK') {
          return {
            lat: parseFloat(data.response.result.point.y),
            lng: parseFloat(data.response.result.point.x)
          };
        }
      } catch {
        return null;
      }
      return null;
    };

    let result = await tryFetch(cleanAddr, 'road');
    if (!result) result = await tryFetch(cleanAddr, 'parcel');
    
    if (!result) {
      const shortAddr = cleanAddr.split(' ').slice(0, -1).join(' ');
      if (shortAddr.length > 5) {
        result = await tryFetch(shortAddr, 'road');
      }
    }
    return result;
  };

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const winL = (window as unknown as WindowWithLeaflet).L;
    if (!winL) return;

    const map = winL.map(mapRef.current).setView([37.5665, 126.9780], 12);
    winL.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    mapInstance.current = map;

    const fetchChargeData = async () => {
      try {
        setStatusMsg("📍 한전 데이터 로드 중...");
        const API_KEY = '334T4VH9T19B4MgvaGC948EcIIHONmCo7qSjyvu1';
        const params = new URLSearchParams({
          apiKey: API_KEY,
          returnType: 'json',
          viewCount: '20', // 테스트를 위해 20개만
          pageNo: '1',
          metroCd: '11',
        });

        const url = `/api-kepco/openapi/v1/EVcharge.do?${params.toString()}`;
        const response = await fetch(url);
        const json = await response.json();

        if (json?.data) {
          setStatusMsg("🚚 좌표 변환 진행 중...");
          
          const results = [];
          for (const item of json.data) {
            const coords = await getCoords(item.stnAddr);
            if (coords) {
              results.push({ ...item, lat: coords.lat, lng: coords.lng });
            }
          }
          
          setRealData(results);
          setStatusMsg(`✅ 로드 완료 (${results.length}개 표시)`);
        }
      } catch (error) {
        console.error("Data Load Error:", error);
        setStatusMsg("❌ 서버 연결 실패");
      }
    };

    fetchChargeData();

    const check = setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (window as any).L?.markerClusterGroup === 'function') {
        setIsClusterReady(true);
        clearInterval(check);
      }
    }, 500);
    return () => clearInterval(check);
  }, []);

  useEffect(() => {
    if (!mapInstance.current || realData.length === 0 || !isClusterReady) return;

    const map = mapInstance.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winL = (window as any).L;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.eachLayer((layer: any) => {
      if (layer instanceof winL.Marker || (layer._group && layer instanceof winL.LayerGroup)) {
        map.removeLayer(layer);
      }
    });

    const clusterGroup = winL.markerClusterGroup();

    realData.forEach((item) => {
      if (item.lat && item.lng) {
        const marker = winL.marker([item.lat, item.lng], { icon: RedIcon })
          .bindPopup(`
            <div style="padding: 5px; min-width: 150px;">
              <strong style="color: #e11d48;">${item.stnPlace}</strong><br/>
              <small>${item.stnAddr}</small><br/>
              <div style="margin-top: 5px; font-size: 11px;">
                급속: ${item.rapidCnt} | 완속: ${item.slowCnt}
              </div>
            </div>
          `);
        clusterGroup.addLayer(marker);
      }
    });

    map.addLayer(clusterGroup);
    
    if (realData.length > 0) {
      map.panTo([realData[0].lat!, realData[0].lng!]);
    }
  }, [realData, isClusterReady]);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-gray-50">
      <header className="p-4 bg-rose-500 text-white shadow-md z-[1000] flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight">EV Map</h1>
          <p className="text-[10px] opacity-70">KEPCO & VWorld Open API</p>
        </div>
        <div className="bg-white/20 px-4 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm">
          {statusMsg}
        </div>
      </header>
      <div ref={mapRef} className="flex-1 w-full" />
    </div>
  );
}

export default App;