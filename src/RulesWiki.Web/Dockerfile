FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Directory.Build.props", "./"]
COPY ["src/RulesWiki.Web/RulesWiki.Web.csproj", "src/RulesWiki.Web/"]
RUN dotnet restore "src/RulesWiki.Web/RulesWiki.Web.csproj"
COPY . .
RUN dotnet publish "src/RulesWiki.Web/RulesWiki.Web.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "RulesWiki.Web.dll"]
