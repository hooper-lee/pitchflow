"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ActivityFeed() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">最近动态</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[
            { text: "创建营销活动后，将在此显示动态", time: "—", empty: true },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="h-2 w-2 mt-2 rounded-full bg-muted-foreground/30" />
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
