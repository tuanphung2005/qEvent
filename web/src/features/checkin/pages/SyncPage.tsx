import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { routes } from "@/lib/routes";
import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

export function SyncPage() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-display text-foreground">Đồng bộ</h1>
          <p className="text-sm text-muted-foreground">
            Trạng thái kết nối của cổng soát vé trên trình duyệt này.
          </p>
        </div>
        <Badge
          variant="secondary"
          className={online ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}
        >
          {online ? "Đang trực tuyến" : "Đang ngoại tuyến"}
        </Badge>
      </header>

      <Alert variant={online ? "default" : "destructive"}>
        {online ? <Wifi /> : <WifiOff />}
        <AlertTitle>
          {online ? "Soát vé trực tuyến đang hoạt động" : "Không có kết nối mạng"}
        </AlertTitle>
        <AlertDescription>
          {online
            ? "Mỗi lượt quét gửi thẳng tới máy chủ và được ghi nhận ngay. Web không giữ hàng đợi ngoại tuyến."
            : "Web không soát được khi mất mạng. Kết nối lại Wi-Fi hoặc 4G trước khi quét vé tiếp."}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-title">Vì sao web chỉ soát online</CardTitle>
          <CardDescription>
            Quyết định của MVP: web không quyết định kết quả soát khi chưa có máy chủ xác nhận.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted-foreground">
            <li>
              Vé chỉ được đánh dấu đã soát khi máy chủ trả về kết quả, nên hai cổng không soát
              trùng.
            </li>
            <li>
              Mất mạng thì không kết luận xanh: màn hình quét báo "cần mạng" thay vì đoán kết quả.
            </li>
            <li>
              Soát ngoại tuyến có hàng đợi thuộc ứng dụng mobile, nơi có lưu trữ cục bộ và đối soát
              khi có mạng.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Empty className="p-6">
            <EmptyHeader>
              <EmptyTitle>Không có hàng đợi trên web</EmptyTitle>
              <EmptyDescription>
                Bản web không lưu lượt soát ngoại tuyến, nên không có mục nào cần đồng bộ hay xử lý
                xung đột. Theo dõi lượt soát đã ghi nhận ở màn hình check-in.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="secondary">
                  <Link to={routes.scan()}>Mở quét vé</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to={routes.checkins()}>Theo dõi check-in</Link>
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    </div>
  );
}
